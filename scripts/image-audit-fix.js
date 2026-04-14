#!/usr/bin/env node
/**
 * image-audit-fix.js — Image audit and Unsplash replacement
 *
 * Usage:
 *   node scripts/image-audit-fix.js --audit              # Show stats only
 *   node scripts/image-audit-fix.js --fix-dupes          # Replace duplicate featured images
 *   node scripts/image-audit-fix.js --fill-missing       # Add images to posts with none (up to --limit N)
 *   node scripts/image-audit-fix.js --fill-missing --limit 50
 *   node scripts/image-audit-fix.js --slug my-post       # Fix one specific post
 *   node scripts/image-audit-fix.js --all                # Fix dupes + fill missing
 *   node scripts/image-audit-fix.js --dry-run --fill-missing  # Preview without saving
 *
 * Requires:
 *   UNSPLASH_ACCESS_KEY env var or scripts/unsplash.key file
 *
 * Rate limits:
 *   Unsplash demo  : 50 req/hour  (default new keys)
 *   Unsplash prod  : 5 000 req/hour (after approval)
 *   Script default : 1 req/1.5s ≈ 2 400/hour — fine for production keys
 */

'use strict';

const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const { PrismaClient } = require('@prisma/client');

// ─── Config ───────────────────────────────────────────────────────────────────

const STATE_FILE  = path.join(__dirname, 'image-audit-state.json');
const KEY_FILE    = path.join(__dirname, 'unsplash.key');
const DELAY_MS    = 1500;   // ~40 req/min, ≈2 400/hour (within prod limit)
const PER_PAGE    = 5;      // fetch N candidates, pick first unused
const ORIENTATION = 'landscape';
// Unsplash "regular" = ~1080px wide, ideal for og:image
const IMG_SIZE    = 'regular';

// Stopwords stripped before building Unsplash query
const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','shall','can',
  'how','what','why','when','where','who','which','that','this','these',
  'your','my','our','their','its','his','her','i','you','we','they','it',
  'all','any','both','each','few','more','most','other','some','such',
  'than','too','very','just','not','no','nor','so','yet','both','either',
  'from','up','about','into','through','during','before','after','above',
  'between','out','off','over','under','again','then','once','here',
]);

// ─── API key ──────────────────────────────────────────────────────────────────

function getApiKey() {
  if (process.env.UNSPLASH_ACCESS_KEY) return process.env.UNSPLASH_ACCESS_KEY.trim();
  if (fs.existsSync(KEY_FILE))         return fs.readFileSync(KEY_FILE, 'utf8').trim();
  return null;
}

// ─── State ────────────────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { assigned: {}, usedIds: new Set() }; }
}

function saveState(state) {
  const out = { ...state, usedIds: [...state.usedIds] };
  fs.writeFileSync(STATE_FILE, JSON.stringify(out, null, 2));
}

function hydrateState(raw) {
  raw.usedIds = new Set(raw.usedIds || raw.usedPexelsIds || []);
  return raw;
}

// ─── Unsplash API ─────────────────────────────────────────────────────────────

function unsplashSearch(query, apiKey, page) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      query,
      per_page:    PER_PAGE,
      orientation: ORIENTATION,
      page:        page || 1,
    });
    const req = https.request({
      hostname: 'api.unsplash.com',
      path:     '/search/photos?' + params.toString(),
      method:   'GET',
      headers:  {
        'Authorization':  'Client-ID ' + apiKey,
        'Accept-Version': 'v1',
      },
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          resolve({ status: res.statusCode, data, remaining: res.headers['x-ratelimit-remaining'] });
        } catch {
          resolve({ status: res.statusCode, data: null });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Build search query from post title
function buildQuery(title) {
  const words = title
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  return words.slice(0, 4).join(' ') || title.slice(0, 40);
}

// Find an unused Unsplash photo for a post
async function findPhoto(title, apiKey, usedIds) {
  const query = buildQuery(title);
  process.stdout.write('  query: "' + query + '" ... ');

  for (let page = 1; page <= 3; page++) {
    const result = await unsplashSearch(query, apiKey, page);

    if (result.status === 429 || result.status === 403) {
      // Unsplash returns 403 (not 429) when hourly quota is exhausted
      const isLimit = result.status === 429 ||
        (result.data && JSON.stringify(result.data).toLowerCase().includes('rate limit'));
      if (isLimit || result.remaining === '0') {
        console.log('RATE LIMITED — demo quota is 50 req/hour. Run again in ~1 hour.');
        return 'RATE_LIMITED';
      }
      console.log('UNAUTHORIZED — check your Unsplash Access Key');
      process.exit(1);
    }
    if (result.status !== 200 || !result.data || !result.data.results) {
      console.log('API error ' + result.status);
      return null;
    }

    const photos = result.data.results;
    if (photos.length === 0) break;

    for (const photo of photos) {
      if (!usedIds.has(photo.id)) {
        const url = photo.urls[IMG_SIZE] || photo.urls.full || photo.urls.raw;
        const photographer = photo.user ? photo.user.name : 'Unknown';
        const unsplashUrl  = photo.links ? photo.links.html + '?utm_source=sergovantseva&utm_medium=referral' : '';
        if (result.remaining !== undefined) {
          process.stdout.write('[rem:' + result.remaining + '] ');
        }
        console.log('OK (id:' + photo.id + ')');
        return { id: photo.id, url, photographer, unsplashUrl };
      }
    }
  }

  // Fallback: broader query (first 2 words)
  const broadQuery = buildQuery(title).split(' ').slice(0, 2).join(' ');
  if (broadQuery && broadQuery !== buildQuery(title)) {
    process.stdout.write('  fallback: "' + broadQuery + '" ... ');
    const result = await unsplashSearch(broadQuery, apiKey, 1);
    if (result.status === 200 && result.data && result.data.results) {
      for (const photo of result.data.results) {
        if (!usedIds.has(photo.id)) {
          const url = photo.urls[IMG_SIZE] || photo.urls.full || photo.urls.raw;
          const photographer = photo.user ? photo.user.name : 'Unknown';
          console.log('OK fallback (id:' + photo.id + ')');
          return { id: photo.id, url, photographer, unsplashUrl: '' };
        }
      }
    }
  }

  console.log('no unused photo found');
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Audit ────────────────────────────────────────────────────────────────────

async function audit(prisma) {
  const posts = await prisma.post.findMany({
    where:  { status: 'published' },
    select: { slug: true, title: true, featuredImage: true },
  });

  const withImage    = posts.filter(p => p.featuredImage);
  const withoutImage = posts.filter(p => !p.featuredImage);

  const imageCounts = {};
  for (const p of withImage) {
    if (!imageCounts[p.featuredImage]) imageCounts[p.featuredImage] = [];
    imageCounts[p.featuredImage].push(p.slug);
  }
  const duplicates = Object.entries(imageCounts).filter(([, slugs]) => slugs.length > 1);

  console.log('\nImage Audit Report');
  console.log('='.repeat(48));
  console.log('Total posts       : ' + posts.length);
  console.log('With image        : ' + withImage.length);
  console.log('Without image     : ' + withoutImage.length + '  ← need Unsplash fill');
  console.log('Unique images     : ' + Object.keys(imageCounts).length);
  console.log('Duplicate URLs    : ' + duplicates.length);
  console.log('Posts w/ dupes    : ' + duplicates.reduce((s, [, sl]) => s + sl.length, 0));

  if (duplicates.length > 0) {
    console.log('\nDuplicate images:');
    for (const [url, slugs] of duplicates.sort((a, b) => b[1].length - a[1].length)) {
      console.log('  x' + slugs.length + ' ' + url.slice(0, 70));
      for (const s of slugs) console.log('    → ' + s);
    }
  }

  const state = hydrateState(loadState());
  console.log('\nPreviously assigned by this script : ' + Object.keys(state.assigned).length);
  console.log('Used Unsplash IDs                  : ' + state.usedIds.size);
  console.log('');
}

// ─── Fix duplicates ───────────────────────────────────────────────────────────

async function fixDuplicates(prisma, apiKey, state, dryRun) {
  const posts = await prisma.post.findMany({
    where:  { status: 'published', NOT: { featuredImage: null } },
    select: { slug: true, title: true, featuredImage: true },
  });

  const imageCounts = {};
  for (const p of posts) {
    if (!imageCounts[p.featuredImage]) imageCounts[p.featuredImage] = [];
    imageCounts[p.featuredImage].push(p);
  }

  const dupeGroups = Object.values(imageCounts).filter(g => g.length > 1);
  if (dupeGroups.length === 0) { console.log('No duplicate images found.'); return; }

  console.log('Found ' + dupeGroups.length + ' duplicate group(s)\n');

  for (const group of dupeGroups) {
    const toReplace = group.slice(1);
    for (const post of toReplace) {
      console.log('[' + post.slug + ']');
      const photo = await findPhoto(post.title, apiKey, state.usedIds);
      if (photo === 'RATE_LIMITED') { console.log('Stopped — quota exhausted.'); break; }
      if (!photo) { await sleep(DELAY_MS); continue; }

      if (!dryRun) {
        await prisma.post.update({ where: { slug: post.slug }, data: { featuredImage: photo.url } });
        state.assigned[post.slug] = { url: photo.url, unsplashId: photo.id, ts: Date.now() };
        state.usedIds.add(photo.id);
        saveState(state);
      } else {
        console.log('  [DRY] would set: ' + photo.url.slice(0, 80));
      }

      await sleep(DELAY_MS);
    }
  }
}

// ─── Fill missing ─────────────────────────────────────────────────────────────

async function fillMissing(prisma, apiKey, state, dryRun, limit) {
  const posts = await prisma.post.findMany({
    where:   { status: 'published', featuredImage: null },
    select:  { slug: true, title: true },
    orderBy: { createdAt: 'desc' },
    take:    limit || 9999,
  });

  const todo = posts.filter(p => !state.assigned[p.slug]);

  console.log('Posts without image : ' + posts.length);
  console.log('Already assigned    : ' + (posts.length - todo.length));
  console.log('To process          : ' + Math.min(todo.length, limit || todo.length));
  if (dryRun) console.log('[DRY RUN]\n');
  else        console.log('');

  let done = 0, failed = 0;
  const max = limit ? Math.min(todo.length, limit) : todo.length;

  for (let i = 0; i < max; i++) {
    const post = todo[i];
    console.log('[' + (i + 1) + '/' + max + '] ' + post.slug);

    const photo = await findPhoto(post.title, apiKey, state.usedIds);
    if (photo === 'RATE_LIMITED') {
      console.log('\nStopped early — hourly quota exhausted after ' + done + ' assignments.');
      console.log('State saved. Run again in ~1 hour to continue from post ' + (i + 1) + '/' + max + '.');
      break;
    }
    if (!photo) { failed++; await sleep(DELAY_MS); continue; }

    if (!dryRun) {
      await prisma.post.update({ where: { slug: post.slug }, data: { featuredImage: photo.url } });
      state.assigned[post.slug] = { url: photo.url, unsplashId: photo.id, ts: Date.now() };
      state.usedIds.add(photo.id);
      saveState(state);
    } else {
      console.log('  [DRY] → ' + photo.url.slice(0, 80));
    }

    done++;
    await sleep(DELAY_MS);
  }

  console.log('\n' + '─'.repeat(48));
  console.log('Assigned : ' + done);
  console.log('Failed   : ' + failed);
  if (dryRun) console.log('[DRY RUN] No changes written.');
}

// ─── Single post ──────────────────────────────────────────────────────────────

async function fixSlug(prisma, slug, apiKey, state, dryRun) {
  const post = await prisma.post.findUnique({
    where:  { slug },
    select: { slug: true, title: true, featuredImage: true },
  });
  if (!post) { console.error('Post not found: ' + slug); process.exit(1); }

  console.log('Post    : ' + post.title);
  console.log('Current : ' + (post.featuredImage || '(none)'));

  const photo = await findPhoto(post.title, apiKey, state.usedIds);
  if (!photo) { console.log('No photo found.'); return; }

  console.log('New URL : ' + photo.url);
  console.log('Credit  : ' + photo.photographer + ' — ' + photo.unsplashUrl);

  if (!dryRun) {
    await prisma.post.update({ where: { slug }, data: { featuredImage: photo.url } });
    state.assigned[slug] = { url: photo.url, unsplashId: photo.id, ts: Date.now() };
    state.usedIds.add(photo.id);
    saveState(state);
    console.log('Saved.');
  } else {
    console.log('[DRY RUN] Not saved.');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args   = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit  = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1])
    : null;

  if (args.includes('--audit')) {
    const prisma = new PrismaClient();
    try { await audit(prisma); } finally { await prisma.$disconnect(); }
    return;
  }

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node scripts/image-audit-fix.js --audit');
    console.log('  node scripts/image-audit-fix.js --fix-dupes [--dry-run]');
    console.log('  node scripts/image-audit-fix.js --fill-missing [--limit N] [--dry-run]');
    console.log('  node scripts/image-audit-fix.js --all [--limit N] [--dry-run]');
    console.log('  node scripts/image-audit-fix.js --slug <slug> [--dry-run]');
    console.log('\nRequires: UNSPLASH_ACCESS_KEY env var or scripts/unsplash.key file');
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('UNSPLASH_ACCESS_KEY not found.');
    console.error('Set env var: export UNSPLASH_ACCESS_KEY=your_key');
    console.error('Or save to: scripts/unsplash.key');
    process.exit(1);
  }

  console.log('Unsplash key: ' + apiKey.slice(0, 6) + '...');
  if (dryRun) console.log('[DRY RUN MODE]\n');

  const state  = hydrateState(loadState());
  const prisma = new PrismaClient();

  try {
    if (args.includes('--slug')) {
      const slug = args[args.indexOf('--slug') + 1];
      if (!slug) { console.error('--slug requires a value'); process.exit(1); }
      await fixSlug(prisma, slug, apiKey, state, dryRun);

    } else if (args.includes('--fix-dupes')) {
      await fixDuplicates(prisma, apiKey, state, dryRun);

    } else if (args.includes('--fill-missing')) {
      await fillMissing(prisma, apiKey, state, dryRun, limit);

    } else if (args.includes('--all')) {
      await fixDuplicates(prisma, apiKey, state, dryRun);
      console.log('');
      await fillMissing(prisma, apiKey, state, dryRun, limit);
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
