#!/usr/bin/env node
/**
 * smart-indexing.js — Google Indexing API submission script
 * sergovantseva.com
 *
 * Usage:
 *   node scripts/smart-indexing.js --new          # New/updated posts (last 7 days)
 *   node scripts/smart-indexing.js --priority     # EN posts not yet indexed
 *   node scripts/smart-indexing.js --all          # All URLs (respects 200/day limit)
 *   node scripts/smart-indexing.js --slug my-post # Single post (all 11 languages)
 *   node scripts/smart-indexing.js --url https://sergovantseva.com/blog/my-post
 *   node scripts/smart-indexing.js --status       # Show indexing stats
 *   node scripts/smart-indexing.js --new --dry-run
 *
 * Requires:
 *   Place service account JSON key at scripts/service-account.json
 *   OR set env var: SERVICE_ACCOUNT_KEY_FILE=/path/to/key.json
 */

'use strict';

const crypto   = require('crypto');
const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const { PrismaClient } = require('@prisma/client');

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE        = 'https://sergovantseva.com';
const DAILY_LIMIT = 195;   // buffer below Google's 200/day hard limit
const DELAY_MS    = 600;   // ms between requests to avoid burst throttling
const STATE_FILE  = path.join(__dirname, 'indexing-state.json');
const KEY_FILE    = process.env.SERVICE_ACCOUNT_KEY_FILE
                    || path.join(__dirname, 'service-account.json');

const LANG_CODES  = ['en','ru','de','fr','es','it','pl','pt','tr','uk','el'];

// Higher = submitted first
const LANG_PRIORITY = { en:10, ru:8, de:7, fr:7, es:6, it:6, pl:5, pt:5, tr:4, uk:4, el:4 };

// ─── URL helpers ──────────────────────────────────────────────────────────────

function postUrl(lang, slug) {
  return lang === 'en'
    ? BASE + '/blog/' + slug
    : BASE + '/' + lang + '/blog/' + slug;
}

function blogUrl(lang) {
  return lang === 'en' ? BASE + '/blog' : BASE + '/' + lang + '/blog';
}

function homeUrl(lang) {
  return lang === 'en' ? BASE + '/' : BASE + '/' + lang;
}

// ─── State management ────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { submitted: {}, dailyLog: {} }; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function countToday(state) {
  return (state.dailyLog[todayKey()] || []).length;
}

function recordSubmission(state, url, result) {
  const today = todayKey();
  state.submitted[url] = { ts: Date.now(), result };
  if (!state.dailyLog[today]) state.dailyLog[today] = [];
  state.dailyLog[today].push({ url, ts: Date.now(), result });
  // Prune logs older than 30 days
  const cutoff = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);
  for (const key of Object.keys(state.dailyLog)) {
    if (key < cutoff) delete state.dailyLog[key];
  }
}

// ─── JWT / OAuth2 ─────────────────────────────────────────────────────────────

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJwt(sa) {
  const now     = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(header + '.' + payload);
  return header + '.' + payload + '.' + b64url(sign.sign(sa.private_key));
}

function httpsPost(url, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const u    = new URL(url);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const headers = Object.assign({
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(data),
    }, extraHeaders || {});

    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers },
      res => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getAccessToken(sa) {
  const jwt = makeJwt(sa);
  const body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;
  const res  = await httpsPost(
    'https://oauth2.googleapis.com/token', body,
    { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
  );
  if (!res.body.access_token) {
    throw new Error('Auth failed: ' + JSON.stringify(res.body));
  }
  return res.body.access_token;
}

// ─── Indexing API ─────────────────────────────────────────────────────────────

async function submitUrl(token, url) {
  return httpsPost(
    'https://indexing.googleapis.com/v3/urlNotifications:publish',
    { url, type: 'URL_UPDATED' },
    { Authorization: 'Bearer ' + token }
  );
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getPosts(prisma, since) {
  const where = { status: 'published' };
  if (since) where.updatedAt = { gte: since };
  return prisma.post.findMany({
    where,
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
}

// ─── URL queue builders ───────────────────────────────────────────────────────

function buildPostUrls(posts, langs) {
  langs = langs || LANG_CODES;
  const urls = [];
  const now  = Date.now();
  for (const post of posts) {
    const isRecent = (now - new Date(post.updatedAt).getTime()) < 7 * 86400 * 1000;
    for (const lang of langs) {
      urls.push({
        url:      postUrl(lang, post.slug),
        priority: LANG_PRIORITY[lang] + (isRecent ? 5 : 0),
      });
    }
  }
  return urls.sort((a, b) => b.priority - a.priority);
}

function staticUrls() {
  const urls = [];
  for (const lang of LANG_CODES) {
    urls.push({ url: homeUrl(lang), priority: 20 + LANG_PRIORITY[lang] });
    urls.push({ url: blogUrl(lang), priority: 15 + LANG_PRIORITY[lang] });
  }
  return urls.sort((a, b) => b.priority - a.priority);
}

// ─── Submission loop ──────────────────────────────────────────────────────────

async function runBatch(urlList, token, state, dryRun) {
  const quota = DAILY_LIMIT - countToday(state);
  console.log('\n  Daily quota remaining : ' + quota + '/' + DAILY_LIMIT);
  console.log('  URLs in queue         : ' + urlList.length + '\n');

  if (quota <= 0) {
    console.log('Daily quota exhausted. Run again tomorrow.');
    return;
  }

  let submitted = 0, skipped = 0, errors = 0, consecutive403 = 0;

  for (const item of urlList) {
    if (submitted >= quota) {
      console.log('\nQuota reached. ' + (urlList.length - submitted - skipped) + ' URLs remain for tomorrow.');
      break;
    }

    // Stop immediately if Search Console ownership is not set up
    if (consecutive403 >= 3) {
      console.log('\nStopping: 3 consecutive 403 errors.');
      console.log('Add indexing-bot@sergovantseva-seo.iam.gserviceaccount.com as OWNER in Search Console first.');
      saveState(state);
      break;
    }

    const url = item.url || item;

    // Skip recently submitted
    const prev = state.submitted[url];
    if (prev && (Date.now() - prev.ts) < 23 * 3600 * 1000) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log('  [DRY] ' + url);
      submitted++;
      continue;
    }

    process.stdout.write('  -> ' + url + ' ... ');

    try {
      const res = await submitUrl(token, url);
      if (res.status === 200) {
        console.log('OK');
        recordSubmission(state, url, 'ok');
        submitted++;
        consecutive403 = 0;
      } else if (res.status === 429) {
        console.log('RATE LIMITED — stopping');
        saveState(state);
        break;
      } else if (res.status === 403) {
        const msg = (res.body.error && res.body.error.message) || '403';
        console.log('FORBIDDEN: ' + msg);
        errors++;
        consecutive403++;
        // Don't record 403s in state — allow retry once ownership is fixed
      } else {
        const msg = (res.body.error && res.body.error.message) || JSON.stringify(res.body);
        console.log('ERROR ' + res.status + ': ' + msg);
        errors++;
        consecutive403 = 0;
        recordSubmission(state, url, 'error:' + res.status);
      }
    } catch (err) {
      console.log('FAILED: ' + err.message);
      errors++;
      consecutive403 = 0;
    }

    saveState(state);
    await sleep(DELAY_MS);
  }

  console.log('\n  Submitted : ' + submitted);
  console.log('  Skipped   : ' + skipped + ' (already sent <24h ago)');
  console.log('  Errors    : ' + errors);
}

// ─── Status report ────────────────────────────────────────────────────────────

function printStatus(state) {
  const all     = Object.entries(state.submitted);
  const ok      = all.filter(([, v]) => v.result === 'ok').length;
  const err     = all.filter(([, v]) => v.result && v.result.startsWith('error')).length;
  const today   = countToday(state);

  console.log('\nIndexing Status Report');
  console.log('='.repeat(42));
  console.log('Total ever submitted  : ' + all.length);
  console.log('  Successful          : ' + ok);
  console.log('  Errors              : ' + err);
  console.log('Today                 : ' + today + '/' + DAILY_LIMIT);

  const days = {};
  const cutoff = Date.now() - 7 * 86400 * 1000;
  for (const [, v] of all) {
    if (v.ts > cutoff) {
      const d = new Date(v.ts).toISOString().slice(0, 10);
      days[d] = (days[d] || 0) + 1;
    }
  }
  console.log('\nLast 7 days:');
  for (const d of Object.keys(days).sort()) {
    console.log('  ' + d + '  ' + days[d] + ' URLs');
  }
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args   = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // Determine mode
  let mode = '--new';
  for (const a of args) {
    if (a.startsWith('--') && a !== '--dry-run') { mode = a; break; }
  }

  if (mode === '--status') {
    printStatus(loadState());
    return;
  }

  // Load key
  if (!fs.existsSync(KEY_FILE)) {
    console.error('Service account key not found: ' + KEY_FILE);
    console.error('Place it at scripts/service-account.json');
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  console.log('Service account : ' + sa.client_email);

  // Auth
  let token = null;
  if (!dryRun) {
    process.stdout.write('Authenticating  ... ');
    token = await getAccessToken(sa);
    console.log('OK');
  }

  const state  = loadState();
  const prisma = new PrismaClient();

  try {
    let urlList = [];

    if (mode === '--url') {
      const url = args[args.indexOf('--url') + 1];
      if (!url) { console.error('--url requires a URL'); process.exit(1); }
      urlList = [{ url, priority: 99 }];
      console.log('Submitting single URL: ' + url);

    } else if (mode === '--slug') {
      const slug = args[args.indexOf('--slug') + 1];
      if (!slug) { console.error('--slug requires a slug'); process.exit(1); }
      urlList = LANG_CODES.map(lang => ({ url: postUrl(lang, slug), priority: LANG_PRIORITY[lang] }));
      console.log('Submitting "' + slug + '" in ' + urlList.length + ' languages');

    } else if (mode === '--new') {
      const since = new Date(Date.now() - 7 * 86400 * 1000);
      const posts = await getPosts(prisma, since);
      console.log('Recent posts (7 days) : ' + posts.length);
      urlList = staticUrls().concat(buildPostUrls(posts));

    } else if (mode === '--priority') {
      const posts = await getPosts(prisma);
      urlList = staticUrls().concat(
        posts.map(p => ({ url: postUrl('en', p.slug), priority: LANG_PRIORITY['en'] }))
             .filter(item => {
               const s = state.submitted[item.url];
               return !s || s.result !== 'ok';
             })
      );
      console.log('EN URLs not yet indexed : ' + urlList.length);

    } else if (mode === '--all') {
      const posts = await getPosts(prisma);
      const all   = staticUrls().concat(buildPostUrls(posts));
      // Filter already-OK submissions
      urlList = all.filter(item => {
        const s = state.submitted[item.url];
        return !s || s.result !== 'ok';
      });
      console.log('Total URLs  : ' + all.length);
      console.log('Already OK  : ' + (all.length - urlList.length));
      console.log('Remaining   : ' + urlList.length);

    } else {
      console.error('Unknown mode: ' + mode);
      process.exit(1);
    }

    await runBatch(urlList, token, state, dryRun);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Fatal: ' + err.message);
  process.exit(1);
});
