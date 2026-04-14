#!/usr/bin/env node
/**
 * sitemap-gate.js — Batched sitemap generator for translated posts
 *
 * Splits all translated post URLs into sitemap XML files (5 000 URLs each),
 * then drip-feeds one file per day to Google/Bing via sitemap ping.
 * Prevents flooding the crawl budget with all ~16 000 translation URLs at once.
 *
 * Usage:
 *   node scripts/sitemap-gate.js --generate          # Build XML files in public/sitemaps/
 *   node scripts/sitemap-gate.js --submit            # Ping Google with today's batch
 *   node scripts/sitemap-gate.js --generate --submit # Both at once
 *   node scripts/sitemap-gate.js --status            # Show submission state
 *   node scripts/sitemap-gate.js --reset             # Restart from file 1
 *
 * Output:
 *   public/sitemaps/trans-1.xml, trans-2.xml, ...
 *   public/sitemaps/trans-index.xml  (sitemap index)
 *
 * Cron (daily at 09:00):
 *   0 9 * * * cd /var/www/nextblog && node scripts/sitemap-gate.js --submit >> /var/log/sitemap-gate.log 2>&1
 */

'use strict';

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { URL: NodeURL } = require('url');
const { PrismaClient } = require('@prisma/client');

const BASE       = 'https://sergovantseva.com';
const BATCH_SIZE = 5000;
const OUT_DIR    = path.join(__dirname, '..', 'public', 'sitemaps');
const STATE_FILE = path.join(__dirname, 'sitemap-gate-state.json');
const LANGUAGES  = ['ru', 'de', 'fr', 'es', 'it', 'pl', 'pt', 'tr', 'uk', 'el'];

// ─── State ────────────────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { nextFile: 1, submitted: [], lastSubmit: null, totalFiles: 0 }; }
}

function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

// ─── XML helpers ──────────────────────────────────────────────────────────────

function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSitemapXml(urls, lastmod) {
  const items = urls.map(u =>
    '  <url><loc>' + esc(u) + '</loc><lastmod>' + lastmod +
    '</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>'
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    items + '\n</urlset>';
}

function buildIndexXml(fileUrls, today) {
  const items = fileUrls.map(u =>
    '  <sitemap><loc>' + esc(u) + '</loc><lastmod>' + today + '</lastmod></sitemap>'
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    items + '\n</sitemapindex>';
}

// ─── HTTP GET ─────────────────────────────────────────────────────────────────

function httpGet(rawUrl) {
  return new Promise(resolve => {
    let u;
    try { u = new NodeURL(rawUrl); } catch { return resolve({ status: 0 }); }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
        headers: { 'User-Agent': 'SitemapBot/1.0 (sergovantseva.com)' } },
      res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode })); }
    );
    req.on('error', err => resolve({ status: 0, err: err.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, err: 'timeout' }); });
    req.end();
  });
}

// ─── Generate ─────────────────────────────────────────────────────────────────

async function generate(prisma) {
  console.log('Loading posts with translations...');
  const posts = await prisma.post.findMany({
    where:  { status: 'published' },
    select: { slug: true, updatedAt: true, translations: { select: { lang: true } } },
  });

  const urls = [];
  for (const post of posts) {
    const translatedLangs = new Set(post.translations.map(t => t.lang));
    for (const lang of LANGUAGES) {
      if (translatedLangs.has(lang)) {
        urls.push(BASE + '/' + lang + '/blog/' + post.slug);
      }
    }
  }

  console.log('Total translation URLs : ' + urls.length);
  console.log('Batch size             : ' + BATCH_SIZE);
  console.log('Files to generate      : ' + Math.ceil(urls.length / BATCH_SIZE));
  console.log('');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const today    = new Date().toISOString().slice(0, 10);
  const fileUrls = [];
  const batches  = [];

  for (let i = 0; i < urls.length; i += BATCH_SIZE) batches.push(urls.slice(i, i + BATCH_SIZE));

  for (let i = 0; i < batches.length; i++) {
    const filename = 'trans-' + (i + 1) + '.xml';
    const filepath = path.join(OUT_DIR, filename);
    const fileUrl  = BASE + '/sitemaps/' + filename;
    fs.writeFileSync(filepath, buildSitemapXml(batches[i], today));
    fileUrls.push(fileUrl);
    console.log('  Written: public/sitemaps/' + filename + ' (' + batches[i].length + ' URLs)');
  }

  // Sitemap index
  const indexPath = path.join(OUT_DIR, 'trans-index.xml');
  fs.writeFileSync(indexPath, buildIndexXml(fileUrls, today));
  console.log('  Written: public/sitemaps/trans-index.xml (' + fileUrls.length + ' sitemaps)');

  const state = loadState();
  state.totalFiles = batches.length;
  if (state.nextFile > batches.length) state.nextFile = 1;
  saveState(state);

  return batches.length;
}

// ─── Submit ───────────────────────────────────────────────────────────────────

async function submit() {
  const state = loadState();

  if (state.totalFiles === 0) {
    console.log('No sitemaps generated yet. Run --generate first.');
    return;
  }

  if (state.nextFile > state.totalFiles) {
    console.log('All ' + state.totalFiles + ' sitemap files have been submitted.');
    console.log('Run --reset to start over, or --generate to rebuild with fresh data.');
    return;
  }

  const fileN   = state.nextFile;
  const fileUrl = BASE + '/sitemaps/trans-' + fileN + '.xml';

  console.log('Submitting file ' + fileN + '/' + state.totalFiles + ': ' + fileUrl);

  const googleResult = await httpGet('https://www.google.com/ping?sitemap=' + encodeURIComponent(fileUrl));
  console.log('  Google ping : HTTP ' + googleResult.status + (googleResult.status === 200 ? ' OK' : ''));

  const bingResult = await httpGet('https://www.bing.com/ping?sitemap=' + encodeURIComponent(fileUrl));
  console.log('  Bing ping   : HTTP ' + bingResult.status + (bingResult.status === 200 ? ' OK' : ''));

  state.submitted.push({ file: fileN, url: fileUrl, ts: Date.now(), googleStatus: googleResult.status });
  state.nextFile   = fileN + 1;
  state.lastSubmit = new Date().toISOString();
  saveState(state);

  const remaining = state.totalFiles - fileN;
  if (remaining > 0) {
    console.log('\nRemaining: ' + remaining + ' file(s). Next: trans-' + state.nextFile + '.xml');
    console.log('Schedule: run --submit daily (cron: 0 9 * * *)');
  } else {
    console.log('\nAll sitemap files submitted! Run --reset + --submit to cycle again.');
  }
}

// ─── Status ───────────────────────────────────────────────────────────────────

function status() {
  const state = loadState();
  console.log('\nSitemap Gate Status');
  console.log('='.repeat(48));
  console.log('Total files    : ' + state.totalFiles);
  console.log('Next to submit : ' + state.nextFile + (state.totalFiles ? ' / ' + state.totalFiles : ''));
  console.log('Last submit    : ' + (state.lastSubmit || 'never'));
  console.log('Submitted      : ' + state.submitted.length);
  if (state.submitted.length > 0) {
    console.log('\nRecent:');
    for (const s of state.submitted.slice(-5)) {
      const d = new Date(s.ts).toISOString().slice(0, 10);
      console.log('  [' + d + '] trans-' + s.file + '.xml  HTTP ' + s.googleStatus);
    }
  }
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--status'))  { status(); return; }
  if (args.includes('--reset'))   {
    const s = loadState(); s.nextFile = 1; saveState(s);
    console.log('Reset: next --submit will start from trans-1.xml');
    return;
  }

  if (!args.includes('--generate') && !args.includes('--submit')) {
    console.log('Usage:');
    console.log('  node scripts/sitemap-gate.js --generate          Build XML files');
    console.log('  node scripts/sitemap-gate.js --submit            Ping Google today\'s file');
    console.log('  node scripts/sitemap-gate.js --generate --submit Both');
    console.log('  node scripts/sitemap-gate.js --status            State');
    console.log('  node scripts/sitemap-gate.js --reset             Restart from file 1');
    return;
  }

  const prisma = new PrismaClient();
  try {
    if (args.includes('--generate')) {
      const count = await generate(prisma);
      console.log('\nGenerated ' + count + ' sitemap file(s)');
    }
  } finally {
    await prisma.$disconnect();
  }

  if (args.includes('--submit')) {
    console.log('');
    await submit();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
