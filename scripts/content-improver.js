#!/usr/bin/env node
/**
 * content-improver.js
 * Улучшает контент постов: исправляет устаревшие годы и добавляет rel="nofollow"
 *
 * Использование:
 *   node scripts/content-improver.js --stats           # статистика
 *   node scripts/content-improver.js --list            # посты требующие улучшения
 *   node scripts/content-improver.js --fix-years       # исправить устаревшие годы
 *   node scripts/content-improver.js --fix-nofollow    # добавить rel="nofollow"
 *   node scripts/content-improver.js --fix-all         # всё сразу
 *   node scripts/content-improver.js --dry-run         # без записи в БД
 *   node scripts/content-improver.js --limit=100       # ограничить кол-во постов
 */

// Загружаем .env.local вручную (dotenv может не быть установлен)
const fs = require('fs');
const envPath = '/var/www/nextblog/.env.local';
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}
const { PrismaClient } = require('@prisma/client');

// ─── Конфиг ───────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sergovantseva.com';
const SITE_DOMAIN = new URL(SITE_URL).hostname;

// Годы которые считаем устаревшими (последние 6 лет, кроме текущего)
const OUTDATED_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 6 + i)
  .filter(y => y < CURRENT_YEAR);

// Паттерн: "in 2022", "as of 2023", "since 2021", "during 2020", "updated 2024"
const YEAR_PATTERN = new RegExp(
  `((?:in|as of|since|during|updated|by|before|after)\\s+)(${OUTDATED_YEARS.join('|')})(?=\\b)`,
  'gi'
);

// ─── Аргументы ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN      = args.includes('--dry-run');
const FIX_YEARS    = args.includes('--fix-years')    || args.includes('--fix-all');
const FIX_NOFOLLOW = args.includes('--fix-nofollow') || args.includes('--fix-all');
const LIST_ONLY    = args.includes('--list');
const STATS_ONLY   = args.includes('--stats');
const LIMIT_ARG    = args.find(a => a.startsWith('--limit='));
const LIMIT        = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0;

// ─── Утилиты ──────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ─── Логика исправления годов ─────────────────────────────────────────────────

function fixYears(content) {
  if (!content) return { text: content, count: 0 };
  let count = 0;
  const fixed = content.replace(YEAR_PATTERN, (match, prefix, year) => {
    count++;
    return `${prefix}${CURRENT_YEAR}`;
  });
  return { text: fixed, count };
}

function hasOutdatedYears(content) {
  if (!content) return false;
  YEAR_PATTERN.lastIndex = 0;
  return YEAR_PATTERN.test(content);
}

// ─── Логика nofollow ──────────────────────────────────────────────────────────

function addNofollow(content) {
  if (!content) return { text: content, count: 0 };
  let count = 0;

  const fixed = content.replace(
    /<a\b([^>]*?)>/gi,
    (match, attrs) => {
      // Извлекаем href
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) return match;
      const href = hrefMatch[1];

      // Пропускаем не-http ссылки (mailto, tel, #anchor)
      if (!/^https?:\/\//i.test(href)) return match;

      // Пропускаем внутренние ссылки
      try {
        const linkHost = new URL(href).hostname;
        if (linkHost === SITE_DOMAIN || linkHost.endsWith(`.${SITE_DOMAIN}`)) return match;
      } catch {
        return match;
      }

      // Уже есть nofollow?
      if (/\bnofollow\b/i.test(attrs)) return match;

      count++;

      // Есть rel= но без nofollow
      if (/\brel=["'][^"']*["']/i.test(attrs)) {
        const updated = attrs.replace(/(rel=["'])([^"']*)(["'])/i, `$1$2 nofollow$3`);
        return `<a ${updated}>`;
      }

      // Нет rel= — добавляем
      return `<a${attrs} rel="nofollow">`;
    }
  );

  return { text: fixed, count };
}

function needsNofollow(content) {
  if (!content) return false;
  const links = [...content.matchAll(/<a\b([^>]*?)>/gi)];
  for (const [, attrs] of links) {
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (!/^https?:\/\//i.test(href)) continue;
    try {
      const host = new URL(href).hostname;
      if (host === SITE_DOMAIN || host.endsWith(`.${SITE_DOMAIN}`)) continue;
    } catch { continue; }
    if (!/\bnofollow\b/i.test(attrs)) return true;
  }
  return false;
}

// ─── Статистика ───────────────────────────────────────────────────────────────

async function showStats(prisma) {
  const total = await prisma.post.count({ where: { status: 'published' } });

  // Читаем все посты батчами для подсчёта
  let needYears = 0;
  let needNofollow = 0;
  let offset = 0;
  const BATCH = 200;

  while (true) {
    const posts = await prisma.post.findMany({
      where: { status: 'published', content: { not: null } },
      select: { content: true },
      skip: offset,
      take: BATCH,
    });
    if (posts.length === 0) break;

    for (const p of posts) {
      if (hasOutdatedYears(p.content)) needYears++;
      if (needsNofollow(p.content)) needNofollow++;
    }
    offset += posts.length;
  }

  log(`\n📊 Статистика (${CURRENT_YEAR}):`);
  log(`   Постов опубликовано:          ${total}`);
  log(`   С устаревшими годами:         ${needYears}`);
  log(`   Без rel="nofollow" (внешние): ${needNofollow}`);
  log(`   Нуждаются в улучшении:        ${Math.max(needYears, needNofollow)}`);
  log(`   Устаревшие годы в паттерне:   ${OUTDATED_YEARS.join(', ')}`);
  log(`   Сайт (внутренние ссылки):     ${SITE_DOMAIN}`);
}

// ─── Список постов ────────────────────────────────────────────────────────────

async function listPosts(prisma) {
  const posts = await prisma.post.findMany({
    where: { status: 'published', content: { not: null } },
    select: { slug: true, title: true, content: true },
    orderBy: { createdAt: 'desc' },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  log(`\n📋 Посты требующие улучшения:\n`);
  let shown = 0;

  for (const p of posts) {
    const years = hasOutdatedYears(p.content);
    const nofollow = needsNofollow(p.content);
    if (!years && !nofollow) continue;

    const flags = [years && '📅 годы', nofollow && '🔗 nofollow'].filter(Boolean).join(', ');
    log(`   ${p.slug}`);
    log(`   └─ ${flags}`);
    shown++;
  }

  if (shown === 0) log('   Всё в порядке, улучшений не требуется.');
  else log(`\n   Итого: ${shown} постов`);
}

// ─── Исправление постов ───────────────────────────────────────────────────────

async function fixPosts(prisma) {
  const where = { status: 'published', content: { not: null } };
  const total = await prisma.post.count({ where });
  const take = LIMIT > 0 ? LIMIT : total;

  log(`\n🔧 Обрабатываем ${take} постов...`);
  if (DRY_RUN) log('   [DRY-RUN — БД не изменяется]');

  let offset = 0;
  const BATCH = 100;
  let fixedYears = 0;
  let fixedNofollow = 0;
  let updatedPosts = 0;

  while (offset < take) {
    const posts = await prisma.post.findMany({
      where,
      select: { id: true, slug: true, content: true },
      skip: offset,
      take: Math.min(BATCH, take - offset),
      orderBy: { createdAt: 'desc' },
    });

    if (posts.length === 0) break;

    for (const post of posts) {
      let content = post.content;
      let changed = false;
      let yearCount = 0;
      let nofollowCount = 0;

      if (FIX_YEARS) {
        const result = fixYears(content);
        if (result.count > 0) {
          content = result.text;
          yearCount = result.count;
          changed = true;
        }
      }

      if (FIX_NOFOLLOW) {
        const result = addNofollow(content);
        if (result.count > 0) {
          content = result.text;
          nofollowCount = result.count;
          changed = true;
        }
      }

      if (!changed) continue;

      fixedYears += yearCount;
      fixedNofollow += nofollowCount;
      updatedPosts++;

      const parts = [];
      if (yearCount > 0) parts.push(`${yearCount} год(а)`);
      if (nofollowCount > 0) parts.push(`${nofollowCount} nofollow`);
      log(`   ✅ ${post.slug} [${parts.join(', ')}]`);

      if (!DRY_RUN) {
        await prisma.post.update({
          where: { id: post.id },
          data: { content, updatedAt: new Date() },
        });
      }
    }

    offset += posts.length;
  }

  log(`\n─────────────────────────────────`);
  log(`✅ Готово:`);
  log(`   Постов обновлено:       ${updatedPosts}`);
  log(`   Замен годов:            ${fixedYears}`);
  log(`   Добавлено nofollow:     ${fixedNofollow}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!FIX_YEARS && !FIX_NOFOLLOW && !LIST_ONLY && !STATS_ONLY) {
    console.log(`
Использование:
  node scripts/content-improver.js --stats
  node scripts/content-improver.js --list [--limit=N]
  node scripts/content-improver.js --fix-years   [--dry-run] [--limit=N]
  node scripts/content-improver.js --fix-nofollow [--dry-run] [--limit=N]
  node scripts/content-improver.js --fix-all     [--dry-run] [--limit=N]
    `);
    process.exit(0);
  }

  const prisma = new PrismaClient();

  try {
    log('🚀 content-improver.js запущен');

    if (STATS_ONLY) {
      await showStats(prisma);
      return;
    }

    if (LIST_ONLY) {
      await listPosts(prisma);
      return;
    }

    await fixPosts(prisma);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('\n💥 Критическая ошибка:', err.message);
  process.exit(1);
});
