#!/usr/bin/env node
/**
 * title-refresh.js — Update year references in post titles, excerpts, and headings
 *
 * Updates the old year to the current year in:
 *   - Post.title, Post.excerpt
 *   - H1/H2/H3 headings inside Post.content
 *   - PostTranslation.title, PostTranslation.excerpt
 *   - H1/H2/H3 headings inside PostTranslation.content
 *
 * Body paragraphs are intentionally skipped (historical context stays intact).
 *
 * Usage:
 *   node scripts/title-refresh.js --dry-run              # Preview changes
 *   node scripts/title-refresh.js --run                  # Apply all
 *   node scripts/title-refresh.js --slug my-post         # Single post
 *   node scripts/title-refresh.js --from 2025 --to 2026  # Default years
 *   node scripts/title-refresh.js --translations         # Also update translations
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

// ─── Replacers ────────────────────────────────────────────────────────────────

function replaceYear(str, from, to) {
  if (!str) return str;
  return str.replace(new RegExp('\\b' + from + '\\b', 'g'), to);
}

// Only replace inside heading tags — leaves body paragraphs untouched
function replaceYearInHeadings(html, from, to) {
  if (!html) return html;
  return html.replace(
    /<(h[123])([^>]*)>([\s\S]*?)<\/h[123]>/gi,
    function(match, tag, attrs, inner) {
      const newInner = inner.replace(new RegExp('\\b' + from + '\\b', 'g'), to);
      return '<' + tag + attrs + '>' + newInner + '</' + tag + '>';
    }
  );
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

function shortDiff(oldVal, newVal, maxLen) {
  if (!oldVal || !newVal) return '';
  const old = (oldVal || '').slice(0, maxLen || 80);
  const nw  = (newVal || '').slice(0, maxLen || 80);
  return '"' + old + '" → "' + nw + '"';
}

// ─── Process one post ─────────────────────────────────────────────────────────

function processPost(post, from, to) {
  const data = {};

  const newTitle = replaceYear(post.title, from, to);
  if (newTitle !== post.title) data.title = newTitle;

  const newExcerpt = replaceYear(post.excerpt, from, to);
  if (newExcerpt !== post.excerpt) data.excerpt = newExcerpt;

  const newContent = replaceYearInHeadings(post.content, from, to);
  if (newContent !== post.content) data.content = newContent;

  return data;
}

function processTranslation(t, from, to) {
  const data = {};

  const newTitle = replaceYear(t.title, from, to);
  if (newTitle !== t.title) data.title = newTitle;

  const newExcerpt = replaceYear(t.excerpt, from, to);
  if (newExcerpt !== t.excerpt) data.excerpt = newExcerpt;

  const newContent = replaceYearInHeadings(t.content, from, to);
  if (newContent !== t.content) data.content = newContent;

  return data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args   = process.argv.slice(2);
  const dryRun = !args.includes('--run') && !args.includes('--slug');
  const single = args.includes('--slug')        ? args[args.indexOf('--slug')  + 1] : null;
  const from   = args.includes('--from')        ? args[args.indexOf('--from')  + 1] : '2025';
  const to     = args.includes('--to')          ? args[args.indexOf('--to')    + 1] : '2026';
  const doTrans = args.includes('--translations') || args.includes('--run') || single;

  if (!args.includes('--run') && !args.includes('--dry-run') && !single) {
    console.log('Usage:');
    console.log('  node scripts/title-refresh.js --dry-run              Preview');
    console.log('  node scripts/title-refresh.js --run                  Apply all');
    console.log('  node scripts/title-refresh.js --slug <slug>          Single post');
    console.log('  node scripts/title-refresh.js --from 2025 --to 2026  Custom years');
    return;
  }

  console.log('Year refresh: ' + from + ' → ' + to + (dryRun ? '  [DRY RUN]' : ''));
  console.log('Scope: titles, excerpts, H1/H2/H3 headings' + (doTrans ? ' + translations' : ''));
  console.log('');

  const prisma = new PrismaClient();
  try {
    const where = single ? { slug: single } : { status: 'published' };
    const posts = await prisma.post.findMany({
      where,
      select: {
        id: true, slug: true, title: true, excerpt: true, content: true,
        translations: doTrans
          ? { select: { id: true, lang: true, title: true, excerpt: true, content: true } }
          : false,
      },
    });

    let postUpdated  = 0;
    let transUpdated = 0;

    for (const post of posts) {
      const postData = processPost(post, from, to);
      const hasChanges = Object.keys(postData).length > 0;

      if (hasChanges) {
        postUpdated++;
        process.stdout.write('\n[' + post.slug + ']\n');
        if (postData.title)   console.log('  title  : ' + shortDiff(post.title,   postData.title,   100));
        if (postData.excerpt) console.log('  excerpt: ' + shortDiff(post.excerpt, postData.excerpt, 80));
        if (postData.content) console.log('  content headings: updated');

        if (!dryRun) {
          await prisma.post.update({ where: { slug: post.slug }, data: postData });
        }
      }

      // Update translations
      if (doTrans && post.translations) {
        for (const t of post.translations) {
          const tData = processTranslation(t, from, to);
          if (Object.keys(tData).length === 0) continue;

          transUpdated++;
          if (!hasChanges) process.stdout.write('\n[' + post.slug + ']\n');
          console.log('  [' + t.lang + '] ' +
            (tData.title ? shortDiff(t.title, tData.title, 60) :
             tData.content ? 'headings updated' : ''));

          if (!dryRun) {
            await prisma.postTranslation.update({ where: { id: t.id }, data: tData });
          }
        }
      }
    }

    console.log('\n' + '─'.repeat(48));
    console.log('Scanned posts   : ' + posts.length);
    console.log('Updated posts   : ' + postUpdated);
    if (doTrans) console.log('Updated trans   : ' + transUpdated);
    if (dryRun) console.log('\n[DRY RUN] No changes written. Use --run to apply.');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
