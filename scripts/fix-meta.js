#!/usr/bin/env node
/**
 * fix-meta.js — Trim over-long titles and excerpts in bulk
 *
 * Trims at the last word boundary before the limit:
 *   titles  > 60 chars  → trim to last space ≤ 60
 *   excerpts > 155 chars → trim to last space ≤ 155, append "…"
 *
 * Usage:
 *   node scripts/fix-meta.js --dry-run   # Preview only
 *   node scripts/fix-meta.js --run       # Apply
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const TITLE_MAX   = 60;
const EXCERPT_MAX = 155;
const BATCH       = 100;   // concurrent DB writes

// Trim at last word boundary; ellipsis optional
function trimAtWord(str, max, ellipsis) {
  if (!str || str.length <= max) return str;
  const cut       = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  // If no reasonable word boundary, hard-cut
  const trimmed = lastSpace >= Math.floor(max * 0.65)
    ? cut.slice(0, lastSpace).trimEnd()
    : cut.trimEnd();
  return ellipsis ? trimmed + '\u2026' : trimmed;   // U+2026 = …
}

async function main() {
  const args   = process.argv.slice(2);
  const dryRun = !args.includes('--run');

  if (!args.includes('--run') && !args.includes('--dry-run')) {
    console.log('Usage:');
    console.log('  node scripts/fix-meta.js --dry-run   Preview');
    console.log('  node scripts/fix-meta.js --run       Apply');
    return;
  }

  console.log('Trimming titles (>' + TITLE_MAX + ') and excerpts (>' + EXCERPT_MAX + ')' +
    (dryRun ? '  [DRY RUN]' : ''));

  const prisma = new PrismaClient();
  try {
    const posts = await prisma.post.findMany({
      where: { status: 'published' },
      select: { slug: true, title: true, excerpt: true },
    });

    const pending = [];  // { slug, data, oldTitle, oldExcerpt }

    for (const post of posts) {
      const data = {};

      if (post.title && post.title.length > TITLE_MAX) {
        data.title = trimAtWord(post.title, TITLE_MAX, false);
      }
      if (post.excerpt && post.excerpt.length > EXCERPT_MAX) {
        data.excerpt = trimAtWord(post.excerpt, EXCERPT_MAX, true);
      }

      if (Object.keys(data).length > 0) {
        pending.push({ slug: post.slug, data, oldTitle: post.title, oldExcerpt: post.excerpt });
      }
    }

    console.log('Posts to update : ' + pending.length);
    const titleCount   = pending.filter(p => p.data.title   !== undefined).length;
    const excerptCount = pending.filter(p => p.data.excerpt !== undefined).length;
    console.log('  Titles  : ' + titleCount);
    console.log('  Excerpts: ' + excerptCount);

    if (dryRun) {
      // Show first 10 examples
      let shown = 0;
      for (const p of pending) {
        if (shown >= 10) { console.log('  ...'); break; }
        console.log('\n[' + p.slug + ']');
        if (p.data.title)
          console.log('  title  : ' + p.oldTitle.length + 'c → ' + p.data.title.length + 'c  "' + p.data.title + '"');
        if (p.data.excerpt)
          console.log('  excerpt: ' + (p.oldExcerpt||'').length + 'c → ' + p.data.excerpt.length + 'c');
        shown++;
      }
      console.log('\n[DRY RUN] No changes written. Use --run to apply.');
      return;
    }

    // Apply in batches
    let done = 0;
    for (let i = 0; i < pending.length; i += BATCH) {
      const slice = pending.slice(i, i + BATCH);
      await Promise.all(slice.map(p =>
        prisma.post.update({ where: { slug: p.slug }, data: p.data })
      ));
      done += slice.length;
      process.stdout.write('\r  Updated ' + done + '/' + pending.length + '  ');
    }

    console.log('\nDone.');
    console.log('Titles updated  : ' + titleCount);
    console.log('Excerpts updated: ' + excerptCount);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
