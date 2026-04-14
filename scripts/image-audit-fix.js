#!/usr/bin/env node
/**
 * image-audit-fix.js — Image audit and Pexels replacement
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
 *   PEXELS_API_KEY env var or scripts/pexels.key file
 *
 * Rate limits:
 *   Pexels free tier: 200 req/hour, 20,000 req/month
 *   Script defaults to 1 req/sec (3600/hour) — well within limits
 */

'use strict';

const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const { PrismaClient } = require('@prisma/client');

// ─── Config ───────────────────────────────────────────────────────────────────

const STATE_FILE   = path.join(__dirname, 'image-audit-state.json');
const KEY_FILE     = path.join(__dirname, 'pexels.key');
const DELAY_MS     = 1100;   // ~54 req/min, well under 200/hour limit
const PER_PAGE     = 5;      // fetch N candidates, pick best unused one
const ORIENTATION  = 'landscape';
const IMAGE_SIZE   = 'large2x';  // ~1280px wide — good for og:image

// Stopwords to strip before building Pexels query
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
  if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY.trim();
  if (fs.existsSync(KEY_FILE))    return fs.readFileSync(KEY_FILE, 'utf8').trim();
  return null;
}

// ─── State ────────────────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { assigned: {}, usedPexelsIds: new Set() }; }
}

function saveState(state) {
  const out = { ...state, usedPexelsIds: [...state.usedPexelsIds] };
  fs.writeFileSync(STATE_FILE, JSON.stringify(out, null, 2));
}

function hydrateState(raw) {
  raw.usedPexelsIds = new Set(raw.usedPexelsIds || []);
  return raw;
}

// ─── Pexels API ───────────────────────────────────────────────────────────────

function pexelsSearch(query, apiKey, page) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      query,
      per_page: PER_PAGE,
      orientation: ORIENTATION,
      page: page || 1,
    });
    const req = https.request({
      hostname: 'api.pexels.com',
      path:     '/v1/search?' + params.toString(),
      method:   'GET',
      headers:  { Authorization: apiKey },
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          resolve({ status: res.statusCode, data });
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
  // Use first 4 meaningful words
  return words.slice(0, 4).join(' ') || title.slice(0, 40);
}

// Find an unused Pexels photo for a post
async function findPhoto(title, apiKey, usedIds) {
  const query = buildQuery(title);
  process.stdout.write('  query: "' + query + '" ... ');

  for (let page = 1; page <= 3; page++) {
    const result = await pexelsSearch(query, apiKey, page);

    if (result.status === 429) {
      console.log('RATE LIMITED');
      return null;
    }
    if (result.status !== 200 || !result.data || !result.data.photos) {
      console.log('API error ' + result.status);
      return null;
    }

    const photos = result.data.photos;
    if (photos.length === 0) break;

    for (const photo of photos) {
      if (!usedIds.has(photo.id)) {
        const url = photo.src[IMAGE_SIZE] || photo.src.large || photo.src.original;
        console.log('OK (id:' + photo.id + ')');
        return { id: photo.id, url, photographer: photo.photographer, pexelsUrl: photo.url };
      }
    }
    // All photos on this page already used — try next page
  }

  // Fallback: try broader query (first 2 words)
  const broadQuery = buildQuery(title).split(' ').slice(0, 2).join(' ');
  if (broadQuery !== buildQuery(title)) {
    process.stdout.write('  fallback: "' + broadQuery + '" ... ');
    const result = await pexelsSearch(broadQuery, apiKey, 1);
    if (result.status === 200 && result.data && result.data.photos) {
      for (const photo of result.data.photos) {
        if (!usedIds.has(photo.id)) {
          const url = photo.src[IMAGE_SIZE] || photo.src.large || photo.src.original;
          console.log('OK fallback (id:' + photo.id + ')');
          return { id: photo.id, url, photographer: photo.photographer, pexelsUrl: photo.url };
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
    imageCounts[p.featuredImage] = (imageCounts[p.featuredImage] || []);
    imageCounts[p.featuredImage].push(p.slug);
  }
  const duplicates = Object.entries(imageCounts).filter(([, slugs]) => slugs.length > 1);

  console.log('\nImage Audit Report');
  console.log('='.repeat(48));
  console.log('Total posts       : ' + posts.length);
  console.log('With image        : ' + withImage.length);
  console.log('Without image     : ' + withoutImage.length + '  ← need Pexels fill');
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
  console.log('Used Pexels IDs                    : ' + state.usedPexelsIds.size);
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
    // Keep first post as-is, replace the rest
    const toReplace = group.slice(1);
    for (const post of toReplace) {
      console.log('[' + post.slug + ']');
      const photo = await findPhoto(post.title, apiKey, state.usedPexelsIds);
      if (!photo) { await sleep(DELAY_MS); continue; }

      if (!dryRun) {
        await prisma.post.update({ where: { slug: post.slug }, data: { featuredImage: photo.url } });
        state.assigned[post.slug] = { url: photo.url, pexelsId: photo.id, ts: Date.now() };
        state.usedPexelsIds.add(photo.id);
        saveState(state);
      } else {
        console.log('  [DRY] would set: ' + photo.url.slice(0, 80));
      }

      await sleep(DELAY_MS);
    }
  }
}

// ─── Fill missing ──────────────────────────────────────────────────────────────

async function fillMissing(prisma, apiKey, state, dryRun, limit) {
  const posts = await prisma.post.findMany({
    where:   { status: 'published', featuredImage: null },
    select:  { slug: true, title: true },
    orderBy: { createdAt: 'desc' },
    take:    limit || 9999,
  });

  // Skip already assigned in this session
  const todo = posts.filter(p => !state.assigned[p.slug]);

  console.log('Posts without image : ' + posts.length);
  console.log('Already assigned    : ' + (posts.length - todo.length));
  console.log('To process          : ' + Math.min(todo.length, limit || todo.length));
  if (dryRun) console.log('[DRY RUN]\n');
  else console.log('');

  let done = 0, failed = 0;
  const max = limit ? Math.min(todo.length, limit) : todo.length;

  for (let i = 0; i < max; i++) {
    const post = todo[i];
    console.log('[' + (i + 1) + '/' + max + '] ' + post.slug);

    const photo = await findPhoto(post.title, apiKey, state.usedPexelsIds);
    if (!photo) { failed++; await sleep(DELAY_MS); continue; }

    if (!dryRun) {
      await prisma.post.update({ where: { slug: post.slug }, data: { featuredImage: photo.url } });
      state.assigned[post.slug] = { url: photo.url, pexelsId: photo.id, ts: Date.now() };
      state.usedPexelsIds.add(photo.id);
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
  const post = await prisma.post.findUnique({ where: { slug }, select: { slug: true, title: true, featuredImage: true } });
  if (!post) { console.error('Post not found: ' + slug); process.exit(1); }

  console.log('Post    : ' + post.title);
  console.log('Current : ' + (post.featuredImage || '(none)'));

  const photo = await findPhoto(post.title, apiKey, state.usedPexelsIds);
  if (!photo) { console.log('No photo found.'); return; }

  console.log('New URL : ' + photo.url);
  console.log('Credit  : ' + photo.photographer + ' — ' + photo.pexelsUrl);

  if (!dryRun) {
    await prisma.post.update({ where: { slug }, data: { featuredImage: photo.url } });
    state.assigned[slug] = { url: photo.url, pexelsId: photo.id, ts: Date.now() };
    state.usedPexelsIds.add(photo.id);
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
  const limit  = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null;

  // Audit needs no API key
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
    console.log('\nRequires: PEXELS_API_KEY env var or scripts/pexels.key file');
    return;
  }

  // All other modes need API key
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('PEXELS_API_KEY not found.');
    console.error('Set env var: export PEXELS_API_KEY=your_key');
    console.error('Or save to: scripts/pexels.key');
    process.exit(1);
  }

  console.log('Pexels API key: ' + apiKey.slice(0, 8) + '...');
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
