#!/usr/bin/env node
/**
 * translate-remaining.js
 * Переводит незаполненный контент в post_translations через WowaTranslate API
 *
 * Использование:
 *   node scripts/translate-remaining.js                         # обычный запуск
 *   node scripts/translate-remaining.js --batch=50             # размер батча
 *   node scripts/translate-remaining.js --lang=ru              # только один язык
 *   node scripts/translate-remaining.js --dry-run              # без реальных запросов
 *   node scripts/translate-remaining.js --stats                # только статистика
 *   node scripts/translate-remaining.js --seo-only             # excerpt + seoTitle + seoDescription
 */

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

// Загружаем .env.local вручную
const envPath = '/var/www/nextblog/.env.local';
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// ─── Конфиг ───────────────────────────────────────────────────────────────────

const CONFIG = {
  WOWA_API_KEY: process.env.WOWA_API_KEY || '',

  // Маппинг: код в БД -> код WowaTranslate (ISO 639-1 uppercase)
  LANG_MAP: {
    // Only the 10 languages the site serves (see lib/i18n.ts)
    'ru': 'RU', 'de': 'DE', 'fr': 'FR', 'es': 'ES',
    'it': 'IT', 'pl': 'PL', 'pt': 'PT', 'tr': 'TR',
    'uk': 'UK', 'el': 'EL',
  },

  BATCH_SIZE: 50,
  DELAY_MS: 300,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
};

// ─── Аргументы командной строки ───────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const STATS_ONLY = args.includes('--stats');
const SEO_ONLY   = args.includes('--seo-only');
const BATCH_ARG  = args.find(a => a.startsWith('--batch='));
const LANG_ARG   = args.find(a => a.startsWith('--lang='));

if (BATCH_ARG) CONFIG.BATCH_SIZE = parseInt(BATCH_ARG.split('=')[1]);
const ONLY_LANG = LANG_ARG ? LANG_ARG.split('=')[1] : null;

// ─── Утилиты ──────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRealTranslation(original, translated) {
  if (!translated || !original) return false;
  if (translated.trim() === original.trim()) return false;
  const similarity = calcSimilarity(translated, original);
  if (similarity > 0.7) return false;
  if (translated.length < original.length * 0.2) return false;
  return true;
}

function calcSimilarity(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  return intersection.length / Math.max(wordsA.size, wordsB.size);
}

function generateSlug(title, lang) {
  const translit = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo',
    'ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m',
    'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
    'ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch',
    'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  let slug = title.toLowerCase();
  if (['ru', 'uk'].includes(lang)) {
    slug = slug.split('').map(c => translit[c] || c).join('');
  }
  return slug
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

// ─── WowaTranslate API ────────────────────────────────────────────────────────

async function translateText(text, targetLang, retries = 0) {
  if (!text || !text.trim()) return '';
  if (DRY_RUN) return `[DRY-RUN: ${targetLang}] ${text.substring(0, 50)}...`;

  const apiKey = CONFIG.WOWA_API_KEY;
  if (!apiKey) throw new Error('WOWA_API_KEY не задан в .env.local');

  try {
    const response = await fetch('https://app.wowaitranslate.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`WowaTranslate error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const translated = data.translations?.[0]?.text;

    if (!translated) {
      throw new Error(`WowaTranslate пустой ответ: ${JSON.stringify(data)}`);
    }

    return translated;

  } catch (err) {
    if (retries < CONFIG.MAX_RETRIES) {
      log(`⚠ Retry ${retries + 1}/${CONFIG.MAX_RETRIES} для ${targetLang}: ${err.message}`);
      await sleep(CONFIG.RETRY_DELAY_MS * (retries + 1));
      return translateText(text, targetLang, retries + 1);
    }
    throw err;
  }
}

// ─── Основная логика ──────────────────────────────────────────────────────────

async function getStats(prisma) {
  const total = await prisma.post.count({ where: { status: 'published' } });

  const byLang = await prisma.postTranslation.groupBy({
    by: ['lang'],
    _count: { lang: true },
    where: { content: { not: null } },
  });

  const emptyContent = await prisma.postTranslation.count({
    where: {
      content: null,
      lang: ONLY_LANG || { in: Object.keys(CONFIG.LANG_MAP) },
    },
  });

  const emptyAll = await prisma.postTranslation.count({
    where: { lang: ONLY_LANG || { in: Object.keys(CONFIG.LANG_MAP) } },
  });

  log(`\n📊 Статистика:`);
  log(`   Постов опубликовано: ${total}`);
  log(`   Переводов всего: ${emptyAll}`);
  log(`   С контентом: ${emptyAll - emptyContent}`);
  log(`   Без контента (нужно перевести): ${emptyContent}`);
  log(`\n   По языкам (с контентом):`);
  for (const l of byLang) {
    log(`   ${l.lang}: ${l._count.lang}`);
  }

  return emptyContent;
}

async function translatePost(prisma, post, langCode, targetLang) {
  const translation = await prisma.postTranslation.findFirst({
    where: { postId: post.id, lang: langCode },
  });

  const needsContent        = !translation?.content;
  const needsExcerpt        = !translation?.excerpt;
  const needsSeoTitle       = !translation?.seoTitle;
  const needsSeoDescription = !translation?.seoDescription;
  const needsSlug           = !translation?.slug;
  const needsTitle          = !translation?.title || translation?.title === post.title;

  // SEO_ONLY: excerpt + seoTitle + seoDescription (без content)
  const nothingToDo = SEO_ONLY
    ? (!needsExcerpt && !needsSeoTitle && !needsSeoDescription && !needsTitle)
    : (!needsContent && !needsExcerpt && !needsSeoTitle && !needsSeoDescription);
  if (nothingToDo) return { skipped: true };

  const results = {};
  let translatedCount = 0;

  try {
    // content — только без --seo-only
    if (!SEO_ONLY && needsContent && post.content) {
      const translated = await translateText(post.content, targetLang);
      if (isRealTranslation(post.content, translated)) {
        results.content = translated;
        translatedCount++;
      } else {
        log(`  ⚠ Фейковый перевод content для поста ${post.slug} [${langCode}]`);
      }
      await sleep(CONFIG.DELAY_MS);
    }

    // excerpt — включая --seo-only
    if (needsExcerpt && post.excerpt) {
      const translated = await translateText(post.excerpt, targetLang);
      if (isRealTranslation(post.excerpt, translated)) {
        results.excerpt = translated;
        translatedCount++;
      }
      await sleep(CONFIG.DELAY_MS);
    }

    // seoTitle
    if (needsSeoTitle && (post.seoTitle || post.title)) {
      const source = post.seoTitle || post.title;
      const translated = await translateText(source, targetLang);
      if (isRealTranslation(source, translated)) {
        results.seoTitle = translated.substring(0, 65);
        translatedCount++;
      }
      await sleep(CONFIG.DELAY_MS);
    }

    // seoDescription
    if (needsSeoDescription && post.seoDescription) {
      const translated = await translateText(post.seoDescription, targetLang);
      if (isRealTranslation(post.seoDescription, translated)) {
        results.seoDescription = translated.substring(0, 155);
        translatedCount++;
      }
      await sleep(CONFIG.DELAY_MS);
    }

    // title — в seo-only режиме переводим чтобы hreflang работал
    if (needsTitle && post.title) {
      const translated = await translateText(post.title, targetLang);
      if (isRealTranslation(post.title, translated)) {
        results.title = translated.substring(0, 120);
        translatedCount++;
      }
      await sleep(CONFIG.DELAY_MS);
    }

    // slug
    if (needsSlug && (results.seoTitle || results.title || translation?.title)) {
      const titleForSlug = results.seoTitle || results.title || translation?.title || post.title;
      results.slug = generateSlug(titleForSlug, langCode);
    }

    if (translatedCount === 0) return { skipped: true, reason: 'nothing to translate' };

    if (!DRY_RUN) {
      if (translation) {
        await prisma.postTranslation.update({
          where: { id: translation.id },
          data: { ...results, isReal: true, sitemapAt: new Date(), translatedAt: new Date() },
        });
      } else {
        await prisma.postTranslation.create({
          data: {
            postId: post.id,
            lang: langCode,
            title: post.title,
            ...results,
            isReal: true,
            sitemapAt: new Date(),
            translatedAt: new Date(),
          },
        });
      }
    }

    return { success: true, fields: Object.keys(results) };

  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  if (!CONFIG.WOWA_API_KEY && !DRY_RUN && !STATS_ONLY) {
    console.error('\n❌ ОШИБКА: WOWA_API_KEY не задан в .env.local\n');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    log('🚀 translate-remaining.js запущен (WowaTranslate API)');
    if (DRY_RUN)   log('   [DRY-RUN режим — БД не изменяется]');
    if (SEO_ONLY)  log('   [SEO-ONLY — excerpt + seoTitle + seoDescription, без content]');
    if (ONLY_LANG) log(`   Только язык: ${ONLY_LANG}`);

    const remaining = await getStats(prisma);

    if (STATS_ONLY) { log('\n✅ Статистика готова. Выход.'); return; }
    if (remaining === 0) { log('\n✅ Все переводы заполнены!'); return; }

    const langs = ONLY_LANG
      ? (CONFIG.LANG_MAP[ONLY_LANG] ? [[ONLY_LANG, CONFIG.LANG_MAP[ONLY_LANG]]] : [])
      : Object.entries(CONFIG.LANG_MAP);

    if (langs.length === 0) {
      log(`❌ Неизвестный язык: ${ONLY_LANG}`);
      process.exit(1);
    }

    const posts = await prisma.post.findMany({
      where: {
        status: 'published',
        translations: {
          some: {
            lang: ONLY_LANG || { in: Object.keys(CONFIG.LANG_MAP) },
            content: null,
          },
        },
      },
      select: {
        id: true, slug: true, title: true,
        content: true, excerpt: true,
        seoTitle: true, seoDescription: true,
      },
      take: CONFIG.BATCH_SIZE,
      orderBy: { createdAt: 'desc' },
    });

    log(`\n📝 Постов к обработке: ${posts.length} (батч ${CONFIG.BATCH_SIZE})`);

    let totalSuccess = 0, totalSkipped = 0, totalErrors = 0;

    for (const post of posts) {
      log(`\n📄 [${posts.indexOf(post) + 1}/${posts.length}] ${post.slug}`);

      for (const [langCode, targetLang] of langs) {
        process.stdout.write(`   ${langCode}... `);
        const result = await translatePost(prisma, post, langCode, targetLang);

        if (result.skipped) {
          process.stdout.write(`⏭\n`);
          totalSkipped++;
        } else if (result.error) {
          process.stdout.write(`❌ ${result.error}\n`);
          totalErrors++;
        } else {
          process.stdout.write(`✅ [${result.fields.join(', ')}]\n`);
          totalSuccess++;
        }
      }
    }

    log(`\n─────────────────────────────────`);
    log(`✅ Готово:`);
    log(`   Переведено: ${totalSuccess}`);
    log(`   Пропущено:  ${totalSkipped}`);
    log(`   Ошибок:     ${totalErrors}`);
    log(`   Осталось ещё: ${remaining - totalSuccess} переводов`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('\n💥 Критическая ошибка:', err.message);
  process.exit(1);
});
