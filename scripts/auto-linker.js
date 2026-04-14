#!/usr/bin/env node
/**
 * auto-linker.js — Internal linking automation
 *
 * Usage:
 *   node scripts/auto-linker.js --dry-run        # Preview only, no DB writes
 *   node scripts/auto-linker.js --run            # Apply links to all posts
 *   node scripts/auto-linker.js --slug my-post   # Single post only
 *   node scripts/auto-linker.js --stats          # Show current link stats
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const MAX_LINKS_PER_POST = 5;
const MIN_TITLE_WORDS    = 3;

// ─── Keyword extraction ───────────────────────────────────────────────────────

// Only use the full cleaned title — most specific, no sliding windows
function titleKeyword(title) {
  const clean = title.replace(/[^\w\s'-]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < MIN_TITLE_WORDS) return null;
  return clean;
}

// ─── Fast link insertion ──────────────────────────────────────────────────────
// Split HTML by tags, search/replace only in text nodes.
// No regex on the full HTML string — avoids catastrophic backtracking.

function insertLink(html, phrase, href) {
  const lowerPhrase = phrase.toLowerCase();

  // Fast pre-check before any work
  if (!html.toLowerCase().includes(lowerPhrase)) return null;

  // Split into alternating [text, tag, text, tag, ...]
  const parts  = html.split(/(<[^>]+>)/);
  let   linked = false;
  let   insideAnchor = false;

  const result = parts.map(part => {
    // Track if we're currently inside an <a> tag
    if (part.startsWith('<')) {
      if (/^<a[\s>]/i.test(part))  insideAnchor = true;
      if (/^<\/a>/i.test(part))    insideAnchor = false;
      return part;
    }

    // Text node — skip if already linked or inside an anchor
    if (linked || insideAnchor) return part;

    const lowerPart = part.toLowerCase();
    const idx = lowerPart.indexOf(lowerPhrase);
    if (idx === -1) return part;

    // Word boundary check (cheap string ops, no regex)
    const charBefore = part[idx - 1];
    const charAfter  = part[idx + phrase.length];
    const boundBefore = idx === 0 || /\W/.test(charBefore);
    const boundAfter  = idx + phrase.length === part.length || /\W/.test(charAfter);
    if (!boundBefore || !boundAfter) return part;

    const matched = part.slice(idx, idx + phrase.length);
    linked = true;
    return (
      part.slice(0, idx) +
      '<a href="' + href + '" class="internal-link">' + matched + '</a>' +
      part.slice(idx + phrase.length)
    );
  });

  return linked ? result.join('') : null;
}

// ─── Existing links ───────────────────────────────────────────────────────────

function existingLinkedSlugs(html) {
  const slugs = new Set();
  const re    = /href=["']\/blog\/([^"'/?#]+)["']/gi;
  let   m;
  while ((m = re.exec(html)) !== null) slugs.add(m[1]);
  return slugs;
}

// ─── Process one post ─────────────────────────────────────────────────────────

function processPost(post, linkMap) {
  let html = post.content || '';
  if (!html.trim()) return { html, linksAdded: [] };

  const linkedTo   = existingLinkedSlugs(html);
  const linksAdded = [];

  for (const { urlSlug, keyword, href } of linkMap) {
    if (linksAdded.length >= MAX_LINKS_PER_POST) break;
    if (urlSlug === post.slug) continue;
    if (linkedTo.has(urlSlug))  continue;

    const newHtml = insertLink(html, keyword, href);
    if (newHtml) {
      html = newHtml;
      linksAdded.push({ slug: urlSlug, phrase: keyword });
      linkedTo.add(urlSlug);
    }
  }

  return { html, linksAdded };
}

// ─── Build link map ───────────────────────────────────────────────────────────

function buildLinkMap(posts) {
  const map = [];
  for (const post of posts) {
    const keyword = titleKeyword(post.title);
    if (keyword) {
      map.push({
        urlSlug:  post.slug,
        keyword,
        href:     '/blog/' + post.slug,
        titleLen: post.title.length,
      });
    }
  }
  // Longest title first (more specific matches take priority)
  return map.sort((a, b) => b.titleLen - a.titleLen);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function printStats(prisma) {
  const posts = await prisma.post.findMany({
    where:  { status: 'published' },
    select: { slug: true, content: true },
  });
  let totalLinks = 0, postsWithLinks = 0;
  for (const post of posts) {
    const n = ((post.content || '').match(/class="internal-link"/g) || []).length;
    if (n > 0) { totalLinks += n; postsWithLinks++; }
  }
  console.log('\nInternal Link Stats');
  console.log('='.repeat(36));
  console.log('Posts with internal links : ' + postsWithLinks + ' / ' + posts.length);
  console.log('Total internal links      : ' + totalLinks);
  console.log('Avg per linked post       : ' +
    (postsWithLinks ? (totalLinks / postsWithLinks).toFixed(1) : 0));
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args   = process.argv.slice(2);
  const dryRun = !args.includes('--run') && !args.includes('--slug');
  const single = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

  if (args.includes('--stats')) {
    const prisma = new PrismaClient();
    try { await printStats(prisma); } finally { await prisma.$disconnect(); }
    return;
  }

  if (!args.includes('--run') && !args.includes('--dry-run') && !single) {
    console.log('Usage:');
    console.log('  node scripts/auto-linker.js --dry-run        Preview changes');
    console.log('  node scripts/auto-linker.js --run            Apply to all posts');
    console.log('  node scripts/auto-linker.js --slug <slug>    Single post');
    console.log('  node scripts/auto-linker.js --stats          Link statistics');
    return;
  }

  const prisma = new PrismaClient();

  try {
    const allPosts = await prisma.post.findMany({
      where:   { status: 'published' },
      select:  { id: true, slug: true, title: true, content: true },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Loaded ' + allPosts.length + ' posts');
    const linkMap = buildLinkMap(allPosts);
    console.log('Link candidates: ' + linkMap.length);

    const toProcess = single ? allPosts.filter(p => p.slug === single) : allPosts;
    if (single && toProcess.length === 0) {
      console.error('Post not found: ' + single); process.exit(1);
    }

    console.log('Processing ' + toProcess.length + ' posts' + (dryRun ? ' [DRY RUN]' : '') + '...\n');

    let totalUpdated = 0, totalLinks = 0, done = 0;
    const t0 = Date.now();

    for (const post of toProcess) {
      done++;
      const { html, linksAdded } = processPost(post, linkMap);

      if (linksAdded.length === 0) {
        // Progress every 100 posts
        if (done % 100 === 0) {
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          process.stdout.write('\r  ' + done + '/' + toProcess.length + ' posts (' + elapsed + 's)  ');
        }
        continue;
      }

      totalUpdated++;
      totalLinks += linksAdded.length;

      process.stdout.write('\r');
      console.log('[' + post.slug + ']');
      for (const l of linksAdded) {
        console.log('  + "' + l.phrase + '" -> /blog/' + l.slug);
      }

      if (!dryRun) {
        await prisma.post.update({ where: { slug: post.slug }, data: { content: html } });
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('\n' + '─'.repeat(48));
    console.log('Done in ' + elapsed + 's');
    console.log('Posts updated  : ' + totalUpdated);
    console.log('Links inserted : ' + totalLinks);
    if (dryRun) console.log('\n[DRY RUN] No changes written. Use --run to apply.');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
