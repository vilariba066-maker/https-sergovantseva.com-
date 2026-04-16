#!/usr/bin/env node
/**
 * gsc-feedback-loop.js — GSC-driven SEO title/description optimizer
 * sergovantseva.com
 *
 * Queries Google Search Console for English pages with:
 *   position 1-25 · impressions ≥ MIN_IMPR · CTR < MAX_CTR%
 * then rewrites seoTitle / seoDescription to improve click-through rate.
 *
 * Usage:
 *   node scripts/gsc-feedback-loop.js --dry-run        Preview changes, no writes
 *   node scripts/gsc-feedback-loop.js --run            Apply + reindex changed posts
 *   node scripts/gsc-feedback-loop.js --stats          Show opportunity report only
 *   node scripts/gsc-feedback-loop.js --limit=N        Cap at N pages
 *   node scripts/gsc-feedback-loop.js --days=N         GSC window (default 28)
 *   node scripts/gsc-feedback-loop.js --max-pos=N      Max avg position (default 25)
 *   node scripts/gsc-feedback-loop.js --min-impr=N     Min impressions (default 100)
 *   node scripts/gsc-feedback-loop.js --max-ctr=N      Max CTR % (default 3)
 *
 * Requires:
 *   scripts/service-account.json with GSC access
 *   Service account must be added as "Full user" in GSC property settings
 *   GSC site: sc-domain:sergovantseva.com
 */

'use strict';

const crypto = require('crypto');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

// ─── Load .env.local ─────────────────────────────────────────────────────────
const envPath = '/var/www/nextblog/.env.local';
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────
const KEY_FILE   = path.join(__dirname, 'service-account.json');
const BASE       = 'https://sergovantseva.com';
const GSC_SITE   = 'https://sergovantseva.com/';
const YEAR       = new Date().getFullYear();
const MAX_TITLE  = 65;
const MIN_DESC   = 120;
const MAX_DESC   = 155;

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const DRY_RUN   = !args.includes('--run');
const STATS     = args.includes('--stats');
const LIMIT     = parseInt((args.find(a => a.startsWith('--limit='))   || '--limit=0').split('=')[1]);
const DAYS      = parseInt((args.find(a => a.startsWith('--days='))    || '--days=28').split('=')[1]);
const MAX_POS   = parseFloat((args.find(a => a.startsWith('--max-pos=')) || '--max-pos=25').split('=')[1]);
const MIN_IMPR  = parseInt((args.find(a => a.startsWith('--min-impr=')) || '--min-impr=100').split('=')[1]);
const MAX_CTR   = parseFloat((args.find(a => a.startsWith('--max-ctr=')) || '--max-ctr=3').split('=')[1]) / 100;

// ─── JWT / OAuth2 (mirrors smart-indexing.js) ────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJwt(sa, scope) {
  const now    = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim  = b64url(JSON.stringify({
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(header + '.' + claim);
  return header + '.' + claim + '.' + b64url(sign.sign(sa.private_key));
}

function httpsReq(method, url, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const u    = new URL(url);
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const headers = Object.assign(
      data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
      extraHeaders || {}
    );
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers },
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
    if (data) req.write(data);
    req.end();
  });
}

async function getAccessToken(sa) {
  const scope = 'https://www.googleapis.com/auth/webmasters.readonly';
  const jwt   = makeJwt(sa, scope);
  const body  = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;
  const res   = await httpsReq(
    'POST', 'https://oauth2.googleapis.com/token', body,
    { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
  );
  if (!res.body.access_token) throw new Error('Auth failed: ' + JSON.stringify(res.body));
  return res.body.access_token;
}

// ─── GSC Search Analytics query ──────────────────────────────────────────────
async function queryGSC(token, days) {
  const end   = new Date(Date.now() - 2 * 86400000); // 2-day GSC lag
  const start = new Date(end - (days - 1) * 86400000);
  const fmt   = d => d.toISOString().slice(0, 10);

  const site   = encodeURIComponent(GSC_SITE);
  const apiUrl = 'https://searchconsole.googleapis.com/webmasters/v3/sites/' + site + '/searchAnalytics/query';

  const payload = {
    startDate:  fmt(start),
    endDate:    fmt(end),
    dimensions: ['page'],
    rowLimit:   1000,
    dataState:  'final',
  };

  console.log('GSC query: ' + fmt(start) + ' → ' + fmt(end) + ' (' + days + ' days)');

  const res = await httpsReq('POST', apiUrl, payload, { Authorization: 'Bearer ' + token });

  if (res.status === 403) {
    const msg = (res.body.error && res.body.error.message) || '403 Forbidden';
    console.error('\nGSC API access denied: ' + msg);
    console.error('Fix: add ' + JSON.parse(fs.readFileSync(KEY_FILE)).client_email +
      ' as a Full user in Google Search Console → Property → Settings → Users and permissions');
    process.exit(1);
  }
  if (res.status !== 200) {
    throw new Error('GSC query failed ' + res.status + ': ' + JSON.stringify(res.body));
  }

  return res.body.rows || [];
}

// ─── URL → English post slug ─────────────────────────────────────────────────
function extractEnglishSlug(url) {
  // Only English canonical: https://sergovantseva.com/blog/<slug>
  const m = url.match(/^https?:\/\/sergovantseva\.com\/blog\/([^/?#]+)\/?$/);
  return m ? m[1] : null;
}

// ─── Opportunity score (potential extra clicks to reach MAX_CTR) ──────────────
function opportunityScore(row) {
  return Math.round(row.impressions * (MAX_CTR - row.ctr));
}

// ─── Title improvement ────────────────────────────────────────────────────────
// Patterns that signal a title already has strong CTR signals
const STRONG_RE = /\b(best|complete|ultimate|proven|top \d|expert|comprehensive|definitive)\b/i;
const GUIDE_RE  = /\b(guide|tips|steps|ways|signs|reasons|habits|checklist)\b/i;
const LEAD_RE   = /^(how\s+to|why\s+|what\s+|when\s+|where\s+|who\s+|\d+\s)/i;

function improveTitle(original, slug) {
  if (!original) return { text: original, changed: false, changes: [] };

  const title  = original.trim();
  const hasYear = /\b20\d{2}\b/.test(title);
  const isStrong = STRONG_RE.test(title);
  const hasGuide = GUIDE_RE.test(title);
  const isLead   = LEAD_RE.test(title);

  const yearTag = ' (' + YEAR + ')';
  const changes = [];
  let best = title;

  // ── Step 1: Add year if missing ──────────────────────────────────────────
  if (!hasYear) {
    const candidate = title + yearTag;
    if (candidate.length <= MAX_TITLE) {
      best = candidate;
      changes.push('year');
    } else {
      // Trim to fit year — clip at last whole word
      const room    = MAX_TITLE - yearTag.length;
      const trimmed = title.slice(0, room).replace(/\s+\S*$/, '').trimEnd();
      if (trimmed.length >= 15) {
        best = trimmed + yearTag;
        changes.push('trimmed+year');
      }
    }
  }

  // ── Step 2: Add power prefix if title is generic ──────────────────────────
  // Skip if: already strong, starts with number/question, has guide keyword
  if (!isStrong && !isLead) {
    const prefix = hasGuide ? 'Complete ' : 'Complete ';
    const candidate = prefix + best;
    if (candidate.length <= MAX_TITLE && !STRONG_RE.test(best)) {
      best = candidate;
      changes.push('prefix:Complete');
    }
  }

  // ── Step 3: Append ": Guide" if short and no guide word ──────────────────
  if (!hasGuide && !isStrong && best.length < 45 && (best + ': Guide').length <= MAX_TITLE) {
    best = best + ': Guide';
    changes.push('suffix:Guide');
  }

  const text = best.slice(0, MAX_TITLE).trimEnd();
  return { text, changed: text !== title, changes };
}

// ─── Description improvement ──────────────────────────────────────────────────
const CTAS = [
  'Read the complete guide.',
  'Learn expert tips today.',
  'Discover proven strategies.',
  'Get actionable advice now.',
  'Start your journey today.',
  'Find out how to begin.',
];

const BENEFITS = [
  ' From a certified relationship coach.',
  ' Evidence-based advice from Natalia Sergovantseva.',
  ' Real techniques that actually work.',
];

function improveDescription(original, title) {
  const hasCta  = /\b(learn|discover|find out|read|start|get|see|explore|try)\b/i;
  const changes = [];

  // Fallback: generate from title if empty
  let desc = (original || '').trim();
  if (!desc) {
    desc = 'Learn ' + title.toLowerCase().replace(/^\w/, c => c.toUpperCase()) +
           ' with practical, expert-backed advice.';
    changes.push('generated');
  }

  // Trim if too long
  if (desc.length > MAX_DESC) {
    desc = desc.slice(0, MAX_DESC - 3).replace(/\s+\S*$/, '').trimEnd() + '...';
    changes.push('trimmed');
  }

  // Append benefit if too short
  if (desc.length < MIN_DESC) {
    const benefit = BENEFITS[Math.abs(desc.length) % BENEFITS.length];
    if ((desc + benefit).length <= MAX_DESC) {
      desc = desc.trimEnd().replace(/\.$/, '') + '.' + benefit;
      changes.push('benefit');
    }
  }

  // Append CTA if missing and there's still room
  if (!hasCta.test(desc) && desc.length < MAX_DESC - 26) {
    const cta = ' ' + CTAS[Math.abs(desc.length) % CTAS.length];
    if ((desc + cta).length <= MAX_DESC) {
      desc = desc.trimEnd().replace(/\.$/, '') + '.' + cta;
      changes.push('cta');
    }
  }

  desc = desc.slice(0, MAX_DESC).trimEnd();
  return { text: desc, changed: desc !== (original || '').trim(), changes };
}

// ─── Print stats / opportunity report ────────────────────────────────────────
function printStats(rows) {
  const en = rows
    .filter(r => extractEnglishSlug(r.keys[0]))
    .map(r => ({
      url:    r.keys[0],
      slug:   extractEnglishSlug(r.keys[0]),
      clicks: r.clicks,
      impr:   r.impressions,
      ctr:    r.ctr,
      pos:    r.position,
      score:  opportunityScore(r),
    }))
    .sort((a, b) => b.score - a.score);

  const qualify = en.filter(r =>
    r.pos <= MAX_POS && r.impr >= MIN_IMPR && r.ctr < MAX_CTR
  );
  const total   = en.length;

  console.log('\nGSC Opportunity Report (' + DAYS + '-day window)');
  console.log('='.repeat(72));
  console.log('Filters: position ≤ ' + MAX_POS + '  impressions ≥ ' + MIN_IMPR +
              '  CTR < ' + (MAX_CTR * 100).toFixed(0) + '%');
  console.log('EN pages tracked  : ' + total);
  console.log('Qualifying pages  : ' + qualify.length);
  if (qualify.length === 0) { console.log('\nNo pages qualify — all CTRs are healthy!'); return; }

  const totalPotential = qualify.reduce((s, r) => s + r.score, 0);
  console.log('Potential +clicks : ≈' + totalPotential + ' extra/period (if all reach ' +
              (MAX_CTR * 100) + '% CTR)');

  console.log('\nTop 20 opportunities:');
  console.log(
    'Rank  Score  CTR%   Pos    Impr   Clicks  Slug'
  );
  console.log('─'.repeat(72));

  const top = qualify.slice(0, 20);
  top.forEach((r, i) => {
    console.log(
      String(i + 1).padStart(4) + '  ' +
      String(r.score).padStart(5) + '  ' +
      (r.ctr * 100).toFixed(1).padStart(5) + '%  ' +
      r.pos.toFixed(1).padStart(5) + '  ' +
      String(r.impr).padStart(6) + '  ' +
      String(r.clicks).padStart(6) + '  ' +
      r.slug
    );
  });
  console.log('');
}

// ─── Reindex a post slug ──────────────────────────────────────────────────────
function reindex(slug, dryRun) {
  if (dryRun) { console.log('    [DRY] reindex skipped'); return; }
  const script = path.join(__dirname, 'smart-indexing.js');
  if (!fs.existsSync(script)) { console.log('    smart-indexing.js not found, skipping'); return; }
  try {
    execSync('node ' + script + ' --slug ' + slug, {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      timeout: 30000,
    });
    console.log('    reindexed');
  } catch (e) {
    console.log('    reindex warning: ' + e.message.slice(0, 80));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!args.includes('--run') && !args.includes('--dry-run') && !STATS) {
    console.log('Usage:');
    console.log('  node scripts/gsc-feedback-loop.js --dry-run        Preview only');
    console.log('  node scripts/gsc-feedback-loop.js --run            Apply + reindex');
    console.log('  node scripts/gsc-feedback-loop.js --stats          Opportunity report');
    console.log('  node scripts/gsc-feedback-loop.js --limit=N        Cap at N pages');
    console.log('  node scripts/gsc-feedback-loop.js --days=28        GSC window days');
    console.log('  node scripts/gsc-feedback-loop.js --max-ctr=3      CTR threshold %');
    console.log('  node scripts/gsc-feedback-loop.js --min-impr=100   Min impressions');
    console.log('\nPrerequisites:');
    console.log('  Add ' + (fs.existsSync(KEY_FILE) ? JSON.parse(fs.readFileSync(KEY_FILE)).client_email : '<email>') +
                ' as Full user in GSC → Property → Settings → Users and permissions');
    return;
  }

  if (!fs.existsSync(KEY_FILE)) {
    console.error('Missing: ' + KEY_FILE);
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  console.log('Service account : ' + sa.client_email);
  console.log('Mode            : ' + (STATS ? 'stats' : DRY_RUN ? 'dry-run' : 'run'));

  // ── Auth ────────────────────────────────────────────────────────────────────
  process.stdout.write('Authenticating  ... ');
  const token = await getAccessToken(sa);
  console.log('OK');

  // ── Query GSC ───────────────────────────────────────────────────────────────
  const rows = await queryGSC(token, DAYS);
  console.log('GSC rows total  : ' + rows.length);

  // ── Stats-only mode ─────────────────────────────────────────────────────────
  if (STATS) {
    printStats(rows);
    return;
  }

  // ── Filter qualifying English pages ──────────────────────────────────────────
  let qualify = rows
    .filter(r => {
      const slug = extractEnglishSlug(r.keys[0]);
      return slug &&
        r.position  <= MAX_POS  &&
        r.impressions >= MIN_IMPR &&
        r.ctr        <  MAX_CTR;
    })
    .map(r => ({
      url:   r.keys[0],
      slug:  extractEnglishSlug(r.keys[0]),
      clicks: r.clicks,
      impr:  r.impressions,
      ctr:   r.ctr,
      pos:   r.position,
      score: opportunityScore(r),
    }))
    .sort((a, b) => b.score - a.score); // highest opportunity first

  if (LIMIT > 0) qualify = qualify.slice(0, LIMIT);

  console.log('Qualifying pages: ' + qualify.length +
    '  (pos≤' + MAX_POS + ', impr≥' + MIN_IMPR + ', CTR<' + (MAX_CTR * 100) + '%)');
  if (qualify.length === 0) {
    console.log('Nothing to optimize. Run --stats to see overall performance.');
    return;
  }

  console.log('Processing ' + qualify.length + ' pages' + (DRY_RUN ? ' [DRY RUN]\n' : '\n'));

  const prisma = new PrismaClient();
  let updated = 0, titleChanged = 0, descChanged = 0, skipped = 0;
  const t0 = Date.now();

  try {
    for (const page of qualify) {
      const post = await prisma.post.findUnique({
        where:  { slug: page.slug },
        select: { id: true, slug: true, title: true, seoTitle: true, seoDescription: true },
      });

      if (!post) { skipped++; continue; }

      const baseTitle = post.seoTitle || post.title;
      const baseDesc  = post.seoDescription || '';

      const newTitle = improveTitle(baseTitle, post.slug);
      const newDesc  = improveDescription(baseDesc, baseTitle);

      const hasChange = newTitle.changed || newDesc.changed;
      if (!hasChange) { skipped++; continue; }

      updated++;
      if (newTitle.changed) titleChanged++;
      if (newDesc.changed)  descChanged++;

      console.log('[' + post.slug + ']');
      console.log('  GSC: pos=' + page.pos.toFixed(1) + ' impr=' + page.impr +
                  ' ctr=' + (page.ctr * 100).toFixed(1) + '% score=+' + page.score + ' clicks');

      if (newTitle.changed) {
        console.log('  title: "' + baseTitle + '"');
        console.log('      → "' + newTitle.text + '"  [' + newTitle.changes.join(', ') + ']');
      }
      if (newDesc.changed) {
        const old = baseDesc ? baseDesc.slice(0, 80) + (baseDesc.length > 80 ? '…' : '') : '(empty)';
        console.log('  desc : ' + old);
        console.log('      → ' + newDesc.text.slice(0, 80) + (newDesc.text.length > 80 ? '…' : '') +
                    '  [' + newDesc.changes.join(', ') + ']');
      }

      if (!DRY_RUN) {
        const data = {};
        if (newTitle.changed) data.seoTitle       = newTitle.text;
        if (newDesc.changed)  data.seoDescription = newDesc.text;
        await prisma.post.update({ where: { slug: post.slug }, data });
        reindex(post.slug, DRY_RUN);
      }
      console.log('');
    }

  } finally {
    await prisma.$disconnect();
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('─'.repeat(56));
  console.log('Done in ' + elapsed + 's');
  console.log('Pages updated   : ' + updated + ' / ' + qualify.length);
  console.log('Titles changed  : ' + titleChanged);
  console.log('Descs changed   : ' + descChanged);
  console.log('Skipped         : ' + skipped + ' (no post or no improvement)');
  if (DRY_RUN) console.log('\n[DRY RUN] No changes written. Use --run to apply.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
