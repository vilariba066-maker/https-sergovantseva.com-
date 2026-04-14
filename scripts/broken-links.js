#!/usr/bin/env node
/**
 * broken-links.js — Finds broken internal and external links
 *
 * Usage:
 *   node scripts/broken-links.js                 # Check all internal links
 *   node scripts/broken-links.js --external      # Also check external links
 *   node scripts/broken-links.js --slug my-post  # Single post only
 *   node scripts/broken-links.js --fix-404       # Remove dead internal links from content
 *
 * Output:
 *   broken-links-report.json  (written to scripts/)
 */

'use strict';

const https    = require('https');
const http     = require('http');
const { URL }  = require('url');
const fs       = require('fs');
const path     = require('path');
const { PrismaClient } = require('@prisma/client');

const BASE         = 'https://sergovantseva.com';
const CONCURRENCY  = 5;
const TIMEOUT_MS   = 10000;
const REPORT_FILE  = path.join(__dirname, 'broken-links-report.json');

const INTERNAL_SLUGS = new Set(); // filled after DB load

// ─── HTTP check ───────────────────────────────────────────────────────────────

function checkUrl(rawUrl) {
  return new Promise(resolve => {
    let url;
    try { url = new URL(rawUrl); } catch {
      return resolve({ url: rawUrl, status: 'invalid', ok: false });
    }

    const lib     = url.protocol === 'https:' ? https : http;
    const timeout = setTimeout(() => {
      req.destroy();
      resolve({ url: rawUrl, status: 'timeout', ok: false });
    }, TIMEOUT_MS);

    const req = lib.request(
      { hostname: url.hostname, path: url.pathname + url.search, method: 'HEAD',
        headers: { 'User-Agent': 'BrokenLinkChecker/1.0 (sergovantseva.com)' } },
      res => {
        clearTimeout(timeout);
        const status = res.statusCode;
        // Follow redirects up to 1 level
        if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location) {
          const redirectTo = res.headers.location.startsWith('http')
            ? res.headers.location
            : BASE + res.headers.location;
          resolve({ url: rawUrl, status, ok: true, redirectTo });
        } else {
          resolve({ url: rawUrl, status, ok: status >= 200 && status < 400 });
        }
      }
    );

    req.on('error', err => {
      clearTimeout(timeout);
      resolve({ url: rawUrl, status: 'error:' + err.code, ok: false });
    });

    req.end();
  });
}

// ─── Extract links from HTML ──────────────────────────────────────────────────

function extractLinks(html, sourceSlug) {
  const links = [];
  const re    = /href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) continue;

    let fullUrl;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      fullUrl = href;
    } else if (href.startsWith('/')) {
      fullUrl = BASE + href;
    } else {
      continue;
    }

    const isInternal = fullUrl.startsWith(BASE);
    links.push({ href, fullUrl, isInternal, source: '/blog/' + sourceSlug });
  }
  return links;
}

// ─── Concurrency pool ────────────────────────────────────────────────────────

async function checkAll(urls, onResult) {
  const queue   = [...urls];
  const active  = new Set();
  let   done    = 0;
  const total   = urls.length;

  return new Promise(resolve => {
    function dispatch() {
      while (active.size < CONCURRENCY && queue.length > 0) {
        const item = queue.shift();
        active.add(item.fullUrl);
        checkUrl(item.fullUrl).then(result => {
          active.delete(item.fullUrl);
          done++;
          process.stdout.write('\r  Checking ' + done + '/' + total + '  ');
          onResult({ ...item, ...result });
          dispatch();
          if (active.size === 0 && queue.length === 0) resolve();
        });
      }
    }
    dispatch();
    if (queue.length === 0) resolve();
  });
}

// ─── Fix 404s in content ─────────────────────────────────────────────────────

async function fix404s(prisma, brokenInternal) {
  if (brokenInternal.length === 0) {
    console.log('No broken internal links to fix.');
    return;
  }

  // Group by source post
  const bySource = {};
  for (const item of brokenInternal) {
    if (!bySource[item.source]) bySource[item.source] = [];
    bySource[item.source].push(item);
  }

  for (const [sourcePath, items] of Object.entries(bySource)) {
    const slug = sourcePath.replace('/blog/', '');
    const post = await prisma.post.findUnique({ where: { slug } });
    if (!post || !post.content) continue;

    let html    = post.content;
    let removed = 0;

    for (const item of items) {
      // Unwrap the <a> tag, keep the link text
      const re = new RegExp('<a[^>]*href=["\']' + item.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\'][^>]*>(.*?)<\/a>', 'gi');
      const newHtml = html.replace(re, '$1');
      if (newHtml !== html) { html = newHtml; removed++; }
    }

    if (removed > 0) {
      await prisma.post.update({ where: { slug }, data: { content: html } });
      console.log('  Fixed ' + removed + ' links in: ' + slug);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args        = process.argv.slice(2);
  const checkExt    = args.includes('--external');
  const singleSlug  = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
  const doFix       = args.includes('--fix-404');

  const prisma = new PrismaClient();

  try {
    const where = { status: 'published' };
    if (singleSlug) where.slug = singleSlug;

    const posts = await prisma.post.findMany({
      where,
      select: { slug: true, content: true },
    });

    // Build set of valid internal slugs
    const allSlugs = await prisma.post.findMany({
      where:  { status: 'published' },
      select: { slug: true },
    });
    for (const p of allSlugs) INTERNAL_SLUGS.add(p.slug);

    console.log('Scanning ' + posts.length + ' posts for links...\n');

    // Collect all unique links
    const seen    = new Map(); // fullUrl -> [{source, href}]
    for (const post of posts) {
      const links = extractLinks(post.content || '', post.slug);
      for (const link of links) {
        if (!checkExt && !link.isInternal) continue;
        if (!seen.has(link.fullUrl)) seen.set(link.fullUrl, []);
        seen.get(link.fullUrl).push({ source: link.source, href: link.href });
      }
    }

    const uniqueUrls = [...seen.entries()].map(([fullUrl, sources]) => ({
      fullUrl,
      isInternal: fullUrl.startsWith(BASE),
      sources,
      href: sources[0].href,
    }));

    console.log('Unique URLs to check: ' + uniqueUrls.length);
    console.log('  Internal : ' + uniqueUrls.filter(u => u.isInternal).length);
    console.log('  External : ' + uniqueUrls.filter(u => !u.isInternal).length + '\n');

    const results  = { ok: [], broken: [], redirects: [] };
    const allItems = [];

    await checkAll(uniqueUrls, result => {
      const sources = seen.get(result.fullUrl) || [];
      const item    = { ...result, sources };
      allItems.push(item);

      if (result.status === 'timeout' || (!result.ok && result.status !== 301 && result.status !== 302)) {
        results.broken.push(item);
      } else if (result.redirectTo) {
        results.redirects.push(item);
      } else {
        results.ok.push(item);
      }
    });

    console.log('\n');

    // ── Report ──
    console.log('Results');
    console.log('='.repeat(48));
    console.log('OK          : ' + results.ok.length);
    console.log('Redirects   : ' + results.redirects.length);
    console.log('BROKEN      : ' + results.broken.length);

    if (results.broken.length > 0) {
      console.log('\nBroken links:');
      for (const item of results.broken) {
        console.log('\n  [' + item.status + '] ' + item.fullUrl);
        for (const src of item.sources) {
          console.log('    found in: ' + src.source);
        }
      }
    }

    if (results.redirects.length > 0) {
      console.log('\nRedirects (consider updating):');
      for (const item of results.redirects) {
        console.log('  [' + item.status + '] ' + item.fullUrl + ' -> ' + item.redirectTo);
      }
    }

    // Save JSON report
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: uniqueUrls.length,
        ok: results.ok.length,
        broken: results.broken.length,
        redirects: results.redirects.length,
      },
      broken:    results.broken,
      redirects: results.redirects,
    };
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log('\nReport saved: scripts/broken-links-report.json');

    // Fix mode
    if (doFix && results.broken.length > 0) {
      const brokenInternal = results.broken.filter(i => i.isInternal);
      console.log('\nFixing ' + brokenInternal.length + ' broken internal links...');
      await fix404s(prisma, brokenInternal.flatMap(i => i.sources.map(s => ({ ...s, fullUrl: i.fullUrl }))));
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
