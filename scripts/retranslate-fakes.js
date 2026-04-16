#!/usr/bin/env node
/**
 * retranslate-fakes.js
 * Сканирует post_translations, находит фейковые переводы и помечает их isReal=false
 *
 * Использование:
 *   node scripts/retranslate-fakes.js --check          # только отчёт, БД не меняется
 *   node scripts/retranslate-fakes.js                  # помечает фейки isReal=false
 *   node scripts/retranslate-fakes.js --lang=ru        # только один язык
 *   node scripts/retranslate-fakes.js --batch=500      # размер батча для проверки
 */

const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const LANG_ARG = args.find(a => a.startsWith('--lang='));
const BATCH_ARG = args.find(a => a.startsWith('--batch='));

const ONLY_LANG = LANG_ARG ? LANG_ARG.split('=')[1] : null;
const BATCH_SIZE = BATCH_ARG ? parseInt(BATCH_ARG.split('=')[1]) : 500;

const KNOWN_LANGS = [
  'de','el','tr','ru','pt','es','it','fr',
  'pl','nl','sv','cs','ro','fi','uk','sk',
  'ja','zh','ko','ar','hi'
];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
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

async function main() {
  const prisma = new PrismaClient();

  try {
    log('🔍 retranslate-fakes.js запущен');
    if (CHECK_ONLY) log('   [CHECK режим — БД не изменяется]');
    if (ONLY_LANG) log(`   Только язык: ${ONLY_LANG}`);

    const langFilter = ONLY_LANG
      ? { lang: ONLY_LANG }
      : { lang: { in: KNOWN_LANGS } };

    // Считаем сколько переводов с контентом
    const totalWithContent = await prisma.postTranslation.count({
      where: { ...langFilter, content: { not: null } },
    });

    log(`\n📊 Переводов с контентом для проверки: ${totalWithContent}`);

    let offset = 0;
    let totalFakes = 0;
    let totalReal = 0;
    let totalSkipped = 0;
    const fakesByLang = {};

    while (offset < totalWithContent) {
      const translations = await prisma.postTranslation.findMany({
        where: { ...langFilter, content: { not: null } },
        select: {
          id: true,
          lang: true,
          content: true,
          post: { select: { content: true, slug: true } },
        },
        skip: offset,
        take: BATCH_SIZE,
      });

      if (translations.length === 0) break;

      const fakeIds = [];

      for (const t of translations) {
        const originalContent = t.post?.content;

        if (!originalContent) {
          totalSkipped++;
          continue;
        }

        const real = isRealTranslation(originalContent, t.content);

        if (!real) {
          fakeIds.push(t.id);
          fakesByLang[t.lang] = (fakesByLang[t.lang] || 0) + 1;
          totalFakes++;
        } else {
          totalReal++;
        }
      }

      if (!CHECK_ONLY && fakeIds.length > 0) {
        await prisma.postTranslation.updateMany({
          where: { id: { in: fakeIds } },
          data: { isReal: false, sitemapAt: null },
        });
        log(`   Помечено фейков: ${fakeIds.length} (offset ${offset})`);
      }

      offset += translations.length;
      process.stdout.write(`   Проверено: ${offset}/${totalWithContent}\r`);
    }

    process.stdout.write('\n');
    log(`\n─────────────────────────────────`);
    log(`✅ Результат:`);
    log(`   Реальных переводов: ${totalReal}`);
    log(`   Фейков найдено:     ${totalFakes}`);
    log(`   Пропущено (нет оригинала): ${totalSkipped}`);

    if (totalFakes > 0) {
      log(`\n   По языкам:`);
      for (const [lang, count] of Object.entries(fakesByLang).sort((a, b) => b[1] - a[1])) {
        log(`   ${lang}: ${count} фейков`);
      }

      if (CHECK_ONLY) {
        log(`\n💡 Для пометки фейков запустите без --check:`);
        log(`   node scripts/retranslate-fakes.js`);
      } else {
        log(`\n💡 Перезапустите translate-remaining.js для повторного перевода:`);
        log(`   node scripts/translate-remaining.js --batch=100`);
      }
    } else {
      log(`\n✅ Фейков не найдено!`);
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('\n💥 Критическая ошибка:', err.message);
  process.exit(1);
});
