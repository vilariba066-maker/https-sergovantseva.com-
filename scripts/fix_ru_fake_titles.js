'use strict';
/**
 * fix_ru_fake_titles.js
 *
 * Fixes two classes of fake Russian titles:
 *
 *   CLASS A — translation has content but title is still English (Latin-only or
 *             identical to original). 130 rows. translate-remaining skips these
 *             because content IS NOT NULL. This script translates the title only.
 *
 *   CLASS B — translation exists but has no content AND title is English.
 *             450 rows. translate-remaining.js will handle these naturally (they
 *             have content: null so they are already in the queue).  We report
 *             the count but do nothing — no wasted API calls.
 *
 * Usage:
 *   node scripts/fix_ru_fake_titles.js --dry-run   # preview, no writes
 *   node scripts/fix_ru_fake_titles.js             # apply title-only fixes
 */

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const envPath = '/var/www/nextblog/.env.local';
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const prisma = new PrismaClient();
const DRY    = process.argv.includes('--dry-run');
const WOWA   = process.env.WOWA_API_KEY || '';
const DELAY  = 350; // ms between API calls

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── WowaTranslate API (same endpoint / auth as translate-remaining.js) ────────
async function translateTitle(text) {
  if (!WOWA) throw new Error('WOWA_API_KEY not set in .env.local');
  const res = await fetch('https://app.wowaitranslate.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${WOWA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: [text], target_lang: 'RU' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.translations?.[0]?.text || null;
}

function isFakeTitle(ruTitle, enTitle) {
  if (!ruTitle) return true;
  if (ruTitle.trim() === enTitle.trim()) return true;
  // Latin-only (no Cyrillic at all)
  if (!/[а-яёА-ЯЁ]/.test(ruTitle)) return true;
  return false;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Mode: ' + (DRY ? 'DRY RUN' : 'LIVE') + '\n');

  // Query all RU translations (with and without content) for published posts
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      pt.id,
      pt.title          AS ru_title,
      p.title           AS en_title,
      (pt.content IS NOT NULL) AS has_content
    FROM post_translations pt
    JOIN posts p ON pt.post_id = p.id
    WHERE pt.lang = 'ru'
      AND p.status = 'published'
      AND (
        pt.title = p.title
        OR pt.title ~ '^[A-Za-z0-9[:punct:][:space:]]+'
        OR pt.title !~ '[а-яёА-ЯЁ]'
      )
    ORDER BY has_content DESC, pt.id
  `);

  const classA = rows.filter(r => r.has_content);  // need fix NOW
  const classB = rows.filter(r => !r.has_content); // already in translate queue

  console.log('Fake Russian titles total     : ' + rows.length);
  console.log('  Class A (has content, need title fix): ' + classA.length);
  console.log('  Class B (no content, already queued) : ' + classB.length);
  console.log();

  if (classA.length === 0) {
    console.log('Nothing to do for Class A.');
    await prisma.$disconnect();
    return;
  }

  let fixed = 0, skipped = 0, errors = 0;

  for (let i = 0; i < classA.length; i++) {
    const row = classA[i];
    const prefix = `[${i + 1}/${classA.length}]`;

    if (DRY) {
      console.log(prefix + ' DRY: ' + row.en_title.slice(0, 60));
      fixed++;
      continue;
    }

    try {
      const translated = await translateTitle(row.en_title);

      if (!translated || translated.trim() === row.en_title.trim() || !/[а-яёА-ЯЁ]/.test(translated)) {
        console.log(prefix + ' ⚠ Fake API response, skipping: ' + row.en_title.slice(0, 50));
        skipped++;
      } else {
        await prisma.postTranslation.update({
          where: { id: row.id },
          data: { title: translated.substring(0, 120) },
        });
        console.log(prefix + ' ✓ ' + translated.slice(0, 70));
        fixed++;
      }
    } catch (e) {
      console.log(prefix + ' ✗ Error: ' + e.message.slice(0, 80));
      errors++;
    }

    await sleep(DELAY);
  }

  console.log('\n' + '─'.repeat(55));
  console.log('Class A fixed  : ' + fixed + ' / ' + classA.length);
  console.log('Skipped (fake) : ' + skipped);
  console.log('Errors         : ' + errors);
  console.log('\nClass B (' + classB.length + ' posts) will be fixed by translate-remaining.js');
  if (DRY) console.log('\n[DRY RUN] No writes. Remove --dry-run to apply.');

  await prisma.$disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
