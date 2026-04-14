#!/usr/bin/env node
/**
 * auto-linker.js — Internal linking automation
 * Scans post content, finds keyword matches to other post titles,
 * inserts <a href> links, and saves back to DB.
 *
 * Usage:
 *   node scripts/auto-linker.js --dry-run        # Preview only, no DB writes
 *   node scripts/auto-linker.js --run            # Apply links to all posts
 *   node scripts/auto-linker.js --slug my-post   # Single post only
 *   node scripts/auto-linker.js --stats          # Show current link stats
 *
 * Strategy:
 *   - Max 5 outbound links added per post
 *   - Never links a post to itself
 *   - Never duplicates an existing link to the same target
 *   - Skips links already present in content
 *   - Prefers longer title matches (more specific)
 *   - Only links first occurrence of each phrase
 *   - Wraps matches in <a href="/blog/slug" class="internal-link">
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const MAX_LINKS_PER_POST = 5;
const MIN_TITLE_WORDS    = 3;   // ignore very short titles as keywords
const BASE               = 'https://sergovantseva.com';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ');
}

// Extract all existing href targets from HTML
function existingLinks(html) {
  const hrefs = new Set();
  const re = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) hrefs.add(m[1]);
  return hrefs;
}

// Build keyword candidates from a post title
// Returns array sorted longest first (most specific match wins)
function titleKeywords(title) {
  // Use full title and also meaningful sub-phrases (4+ word windows)
  const words = title.replace(/[^\w\s'-]/g, '').trim().split(/\s+/).filter(Boolean);
  if (words.length < MIN_TITLE_WORDS) return [];

  const candidates = [title.replace(/[^\w\s'-]/g, '').trim()]; // full title (cleaned)

  // Sliding windows of 4-6 words for long titles
  if (words.length > 5) {
    for (let size = Math.min(words.length, 6); size >= 4; size--) {
      for (let i = 0; i <= words.length - size; i++) {
        candidates.push(words.slice(i, i + size).join(' '));
      }
    }
  }

  // Deduplicate, sort longest first
  return [...new Set(candidates)].sort((a, b) => b.length - a.length);
}

// Insert link for first occurrence of phrase in HTML, outside existing tags
function insertLink(html, phrase, href) {
  // Don't link inside existing tags or attributes
  const re = new RegExp(
    '(?<!<[^>]*)\\b(' + escapeRegex(phrase) + ')\\b(?![^<]*>)(?![^<]*</a>)',
    'i'
  );

  // Check if phrase is already inside an <a> tag
  const insideAnchor = new RegExp(
    '<a[^>]*>[^<]*' + escapeRegex(phrase) + '[^<]*</a>',
    'i'
  );
  if (insideAnchor.test(html)) return null;

  if (!re.test(html)) return null;

  return html.replace(re, '<a href="' + href + '" class="internal-link">$1</a>');
}

// ─── Core linker ──────────────────────────────────────────────────────────────

function buildLinkMap(posts) {
  // slug -> array of keyword candidates, longest first
  const map = [];
  for (const post of posts) {
    const keywords = titleKeywords(post.title);
    if (keywords.length > 0) {
      map.push({ slug: post.id, urlSlug: post.slug, title: post.title, keywords });
    }
  }
  // Sort by longest title first so specific matches take priority
  map.sort((a, b) => b.title.length - a.title.length);
  return map;
}

function processPost(post, linkMap) {
  let html    = post.content || '';
  if (!html.trim()) return { html, linksAdded: [] };

  const selfSlug   = post.slug;
  const existing   = existingLinks(html);
  const linksAdded = [];
  const linkedTo   = new Set(); // track slugs already linked in this post

  // Pre-populate with already-linked targets
  for (const href of existing) {
    const m = href.match(/\/blog\/([^/?#]+)/);
    if (m) linkedTo.add(m[1]);
  }

  for (const candidate of linkMap) {
    if (linksAdded.length >= MAX_LINKS_PER_POST) break;
    if (candidate.urlSlug === selfSlug) continue;      // don't self-link
    if (linkedTo.has(candidate.urlSlug)) continue;     // already linked

    const href = '/blog/' + candidate.urlSlug;

    for (const keyword of candidate.keywords) {
      const newHtml = insertLink(html, keyword, href);
      if (newHtml && newHtml !== html) {
        html = newHtml;
        linksAdded.push({ slug: candidate.urlSlug, phrase: keyword });
        linkedTo.add(candidate.urlSlug);
        break; // one link per target post
      }
    }
  }

  return { html, linksAdded };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function printStats(prisma) {
  const posts = await prisma.post.findMany({
    where: { status: 'published' },
    select: { slug: true, content: true },
  });

  let totalLinks = 0, postsWithLinks = 0;
  for (const post of posts) {
    const links = (post.content || '').match(/class="internal-link"/g);
    if (links) { totalLinks += links.length; postsWithLinks++; }
  }
  console.log('\nInternal Link Stats');
  console.log('='.repeat(36));
  console.log('Posts with internal links : ' + postsWithLinks + ' / ' + posts.length);
  console.log('Total internal links      : ' + totalLinks);
  console.log('Avg links per linked post : ' + (postsWithLinks ? (totalLinks / postsWithLinks).toFixed(1) : 0));
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

  if (dryRun && !args.includes('--dry-run')) {
    console.log('Usage:');
    console.log('  node scripts/auto-linker.js --dry-run        Preview changes');
    console.log('  node scripts/auto-linker.js --run            Apply to all posts');
    console.log('  node scripts/auto-linker.js --slug <slug>    Single post');
    console.log('  node scripts/auto-linker.js --stats          Link statistics');
    return;
  }

  const prisma = new PrismaClient();

  try {
    // Load all published posts for building the link map
    const allPosts = await prisma.post.findMany({
      where:   { status: 'published' },
      select:  { id: true, slug: true, title: true, content: true },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Loaded ' + allPosts.length + ' published posts');
    const linkMap = buildLinkMap(allPosts);

    // Determine which posts to process
    const toProcess = single
      ? allPosts.filter(p => p.slug === single)
      : allPosts;

    if (single && toProcess.length === 0) {
      console.error('Post not found: ' + single);
      process.exit(1);
    }

    console.log('Processing ' + toProcess.length + ' posts' + (dryRun ? ' [DRY RUN]' : '') + '\n');

    let totalUpdated = 0, totalLinks = 0;

    for (const post of toProcess) {
      const { html, linksAdded } = processPost(post, linkMap);

      if (linksAdded.length === 0) continue;

      totalUpdated++;
      totalLinks += linksAdded.length;

      console.log('[' + post.slug + ']');
      for (const l of linksAdded) {
        console.log('  + "' + l.phrase + '" -> /blog/' + l.slug);
      }

      if (!dryRun) {
        await prisma.post.update({
          where: { slug: post.slug },
          data:  { content: html },
        });
      }
    }

    console.log('\n' + '─'.repeat(48));
    console.log('Posts updated  : ' + totalUpdated);
    console.log('Links inserted : ' + totalLinks);
    if (dryRun) console.log('\n[DRY RUN] No changes written. Use --run to apply.');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
