#!/usr/bin/env node
/**
 * auto-linker.js — Keyword-based internal linking
 *
 * Extracts 2-4 significant keywords from each post title, searches other posts'
 * content for those keywords using case-insensitive word-boundary regex, and
 * inserts <a href="/blog/slug" class="internal-link"> around the first match.
 *
 * Rules:
 *   - Skip posts already having MIN_LINKS (3) or more internal links
 *   - Target MIN_LINKS–MAX_LINKS (3–6) per post
 *   - One link per target slug per post
 *   - Never link inside an existing <a> tag
 *   - Rarest (most specific) keywords matched first
 *
 * Usage:
 *   node scripts/auto-linker.js --dry-run          Preview, no DB writes
 *   node scripts/auto-linker.js --run              Apply to all eligible posts
 *   node scripts/auto-linker.js --limit=N          Process only N posts (fewest links first)
 *   node scripts/auto-linker.js --slug my-post     Single post
 *   node scripts/auto-linker.js --stats            Show link stats
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const MIN_LINKS = 3;  // skip posts already at/above this
const MAX_LINKS = 6;  // ceiling per post
const MIN_KW_LEN = 4; // minimum keyword character length
const MAX_KW_PER_POST = 4;   // keywords extracted per title
const DOMAIN_THRESH   = 0.28; // word in >28% of titles → too generic

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'shall','can','not','no','nor','so','yet','both','either','neither',
  'each','few','more','most','other','some','such','than','too','very',
  'just','how','what','when','where','who','which','that','this','these',
  'those','your','you','its','our','their','my','his','her','we','they',
  'it','as','if','up','out','about','into','through','during','before',
  'after','above','below','between','own','same','why','all','any',
  'because','while','although','though','now','then','only','also',
  'much','many','every','never','always','often','get','make','like',
  'know','think','see','look','want','give','use','find','tell','ask',
  'seem','feel','try','leave','call','keep','made','take','need','work',
  'back','even','still','since','here','there','once','over','under',
  'again','further','without','within','whether','wherever','whatever',
  // Generic content words
  'ways','tips','signs','guide','things','life','time','real','good',
  'best','right','true','long','high','well','even','first','last',
  'next','show','read','help','done','said','mean','used','come','goes',
  // Domain-specific generic words for this relationship-coaching blog
  'partner','person','people','woman','women','healthy','better','build',
  'great','love','loved','learn','change','start','stop','avoid','choose',
  'improve','create','important','common','simple','actually','really',
  'relationship','relationships','dating','romance','romantic','date',
  'advice','coach','coaching','therapy','therapist','article',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countInternalLinks(html) {
  return ((html || '').match(/class="internal-link"/g) || []).length;
}

function existingLinkedSlugs(html) {
  const slugs = new Set();
  const re    = /href=["']\/blog\/([^"'/?#]+)["']/gi;
  let   m;
  while ((m = re.exec(html)) !== null) slugs.add(m[1]);
  return slugs;
}

// ─── Keyword extraction ───────────────────────────────────────────────────────

function buildWordFreq(posts) {
  const freq = {};
  for (const post of posts) {
    const seen = new Set(
      post.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= MIN_KW_LEN && !STOP.has(w))
    );
    for (const w of seen) freq[w] = (freq[w] || 0) + 1;
  }
  return freq;
}

/**
 * Extract up to MAX_KW_PER_POST keywords from a title.
 * Filters stop words and words too common across all titles.
 * Sorted rarest-first so the most specific keywords get first-match priority.
 */
function extractKeywords(title, wordFreq, maxCommon) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= MIN_KW_LEN && !STOP.has(w) && (wordFreq[w] || 0) <= maxCommon)
    .sort((a, b) => (wordFreq[a] || 0) - (wordFreq[b] || 0)) // rarest first
    .slice(0, MAX_KW_PER_POST);
}

// ─── Link insertion ───────────────────────────────────────────────────────────

/**
 * Insert a single link around the first word-boundary match of `keyword`
 * in `html`, skipping any text inside an existing <a> tag.
 * Returns the modified HTML, or null if no match found.
 */
function insertLink(html, keyword, href) {
  const pattern = new RegExp('\\b(' + escRe(keyword) + ')\\b', 'i');
  if (!pattern.test(html)) return null; // fast pre-check

  const parts      = html.split(/(<[^>]+>)/);
  let   linked     = false;
  let   inAnchor   = 0;

  const result = parts.map(part => {
    if (part.startsWith('<')) {
      if (/^<a[\s>]/i.test(part))  inAnchor++;
      if (/^<\/a>/i.test(part))    inAnchor = Math.max(0, inAnchor - 1);
      return part;
    }
    if (linked || inAnchor > 0) return part;
    if (!pattern.test(part))    return part;

    linked = true;
    return part.replace(pattern, '<a href="' + href + '" class="internal-link">$1</a>');
  });

  return linked ? result.join('') : null;
}

// ─── Build link map ───────────────────────────────────────────────────────────

function buildLinkMap(posts) {
  const wordFreq = buildWordFreq(posts);
  const maxCommon = Math.floor(posts.length * DOMAIN_THRESH);

  const filtered = Object.entries(wordFreq)
    .filter(([, n]) => n / posts.length > DOMAIN_THRESH)
    .map(([w]) => w);
  if (filtered.length) {
    console.log('Domain-common filtered (' + filtered.length + '): ' + filtered.sort().join(', '));
  }

  const map = [];
  for (const post of posts) {
    const keywords = extractKeywords(post.title, wordFreq, maxCommon);
    for (const kw of keywords) {
      map.push({
        urlSlug: post.slug,
        keyword: kw,
        href:    '/blog/' + post.slug,
        freq:    wordFreq[kw] || 1,
      });
    }
  }

  // Rarest (most specific) first; ties broken by keyword length (longer = more specific)
  return map.sort((a, b) => a.freq - b.freq || b.keyword.length - a.keyword.length);
}

// ─── Process one post ─────────────────────────────────────────────────────────

function processPost(post, linkMap) {
  let html = post.content || '';
  if (!html.trim()) return { html, linksAdded: [], skipped: 'empty' };

  const existing = countInternalLinks(html);
  if (existing >= MIN_LINKS) return { html, linksAdded: [], skipped: 'has-links' };

  const linkedTo   = existingLinkedSlugs(html);
  const linksAdded = [];
  const need       = MAX_LINKS - existing;

  for (const { urlSlug, keyword, href } of linkMap) {
    if (linksAdded.length >= need) break;
    if (urlSlug === post.slug)    continue;
    if (linkedTo.has(urlSlug))    continue;

    const newHtml = insertLink(html, keyword, href);
    if (newHtml) {
      html = newHtml;
      linksAdded.push({ slug: urlSlug, keyword });
      linkedTo.add(urlSlug);
    }
  }

  return { html, linksAdded };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function printStats(prisma) {
  const posts = await prisma.post.findMany({
    where:  { status: 'published' },
    select: { slug: true, content: true },
  });

  let total0 = 0, total1to2 = 0, total3plus = 0, totalLinks = 0;
  for (const p of posts) {
    const n = countInternalLinks(p.content || '');
    totalLinks += n;
    if (n === 0)      total0++;
    else if (n < MIN_LINKS) total1to2++;
    else              total3plus++;
  }

  console.log('\nInternal Link Stats');
  console.log('='.repeat(40));
  console.log('Posts with 0 links   : ' + total0);
  console.log('Posts with 1-2 links : ' + total1to2 + '  (will be topped up to ' + MIN_LINKS + '+)');
  console.log('Posts with 3+ links  : ' + total3plus + '  (skipped)');
  console.log('Total internal links : ' + totalLinks);
  console.log('Avg per linked post  : ' + ((totalLinks / (total1to2 + total3plus)) || 0).toFixed(1));
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args     = process.argv.slice(2);
  const dryRun   = !args.includes('--run') && !args.includes('--slug');
  const single   = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit    = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  if (args.includes('--stats')) {
    const prisma = new PrismaClient();
    try { await printStats(prisma); } finally { await prisma.$disconnect(); }
    return;
  }

  if (!args.includes('--run') && !args.includes('--dry-run') && !single) {
    console.log('Usage:');
    console.log('  node scripts/auto-linker.js --dry-run          Preview, no writes');
    console.log('  node scripts/auto-linker.js --run              Apply to all eligible posts');
    console.log('  node scripts/auto-linker.js --limit=N          Process only N posts');
    console.log('  node scripts/auto-linker.js --slug my-post     Single post');
    console.log('  node scripts/auto-linker.js --stats            Link statistics');
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
    console.log('Keywords in link map : ' + linkMap.length + ' (across ' +
      new Set(linkMap.map(e => e.urlSlug)).size + ' posts)');

    // Build processing list
    let toProcess;
    if (single) {
      toProcess = allPosts.filter(p => p.slug === single);
      if (toProcess.length === 0) { console.error('Post not found: ' + single); process.exit(1); }
    } else {
      // Eligible = posts below MIN_LINKS threshold
      toProcess = allPosts.filter(p => countInternalLinks(p.content || '') < MIN_LINKS);

      if (limit) {
        // Fewest existing links first (most in need)
        toProcess = toProcess
          .sort((a, b) => countInternalLinks(a.content || '') - countInternalLinks(b.content || ''))
          .slice(0, limit);
      }
    }

    const alreadyDone = allPosts.length - allPosts.filter(p => countInternalLinks(p.content || '') < MIN_LINKS).length;
    console.log('Already at 3+ links  : ' + alreadyDone + ' (skipped)');
    console.log('Eligible to process  : ' + toProcess.length + (limit ? ' (limited to ' + limit + ')' : ''));
    console.log('Processing ' + toProcess.length + ' posts' + (dryRun ? ' [DRY RUN]' : '') + '...\n');

    let updated = 0, skippedEmpty = 0, totalNewLinks = 0, done = 0;
    const kwUsed = {};
    const t0 = Date.now();

    for (const post of toProcess) {
      done++;
      const { html, linksAdded, skipped } = processPost(post, linkMap);

      if (skipped === 'empty') { skippedEmpty++; continue; }

      if (linksAdded.length === 0) {
        if (done % 50 === 0) {
          process.stdout.write('\r  ' + done + '/' + toProcess.length + ' posts  (' +
            ((Date.now() - t0) / 1000).toFixed(1) + 's)');
        }
        continue;
      }

      updated++;
      totalNewLinks += linksAdded.length;
      for (const l of linksAdded) kwUsed[l.keyword] = (kwUsed[l.keyword] || 0) + 1;

      process.stdout.write('\r');
      console.log('[' + post.slug + ']');
      for (const l of linksAdded) {
        console.log('  + "' + l.keyword + '" → /blog/' + l.slug);
      }

      if (!dryRun) {
        await prisma.post.update({ where: { slug: post.slug }, data: { content: html } });
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log('\n' + '─'.repeat(52));
    console.log('Done in ' + elapsed + 's');
    console.log('Posts updated        : ' + updated + ' / ' + toProcess.length);
    console.log('New links inserted   : ' + totalNewLinks);
    console.log('Empty posts skipped  : ' + skippedEmpty);

    // Top 10 most-used keywords
    const topKw = Object.entries(kwUsed).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (topKw.length) {
      console.log('\nTop matched keywords:');
      for (const [kw, n] of topKw) console.log('  ' + String(n).padStart(4) + '×  ' + kw);
    }

    if (dryRun) console.log('\n[DRY RUN] No changes written. Use --run to apply.');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
