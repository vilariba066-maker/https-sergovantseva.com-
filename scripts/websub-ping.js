#!/usr/bin/env node
/**
 * websub-ping.js — Notify WebSub hubs and Google when posts are published
 *
 * Sends publish notifications to WebSub hubs (Google PubSubHubbub, Superfeedr)
 * so Google crawls the RSS feed immediately after new content goes live.
 * Also pings Google/Bing sitemap endpoints.
 *
 * Usage:
 *   node scripts/websub-ping.js                  # Posts published in last 24h
 *   node scripts/websub-ping.js --hours 48       # Last 48 hours
 *   node scripts/websub-ping.js --slug my-post   # Single post
 *   node scripts/websub-ping.js --sitemap        # Ping sitemap only (no WebSub)
 *   node scripts/websub-ping.js --all-feeds      # Ping all 11 language feeds
 *
 * Integrate into deploy workflow:
 *   node scripts/websub-ping.js --hours 2
 */

'use strict';

const https = require('https');
const http  = require('http');
const { URL: NodeURL } = require('url');
const { PrismaClient } = require('@prisma/client');

const BASE      = 'https://sergovantseva.com';
const FEED_URL  = BASE + '/feed.xml';
const SITEMAP   = BASE + '/sitemap.xml';
const LANGUAGES = ['en', 'ru', 'de', 'fr', 'es', 'it', 'pl', 'pt', 'tr', 'uk', 'el'];

const HUBS = [
  'https://pubsubhubbub.appspot.com/',
  'https://pubsubhubbub.superfeedr.com/',
];

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpPost(rawUrl, body) {
  return new Promise(resolve => {
    let u;
    try { u = new NodeURL(rawUrl); } catch { return resolve({ status: 0 }); }
    const lib = u.protocol === 'https:' ? https : http;
    const buf = Buffer.from(body, 'utf8');
    const req = lib.request({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': buf.length,
        'User-Agent':     'WebSubPing/1.0 (sergovantseva.com)',
      },
    }, res => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', err => resolve({ status: 0, err: err.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, err: 'timeout' }); });
    req.write(buf);
    req.end();
  });
}

function httpGet(rawUrl) {
  return new Promise(resolve => {
    let u;
    try { u = new NodeURL(rawUrl); } catch { return resolve({ status: 0 }); }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
        headers: { 'User-Agent': 'WebSubPing/1.0 (sergovantseva.com)' } },
      res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode })); }
    );
    req.on('error', err => resolve({ status: 0, err: err.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, err: 'timeout' }); });
    req.end();
  });
}

// ─── Ping one WebSub topic ────────────────────────────────────────────────────

async function pingTopic(topicUrl) {
  const body = 'hub.mode=publish&hub.url=' + encodeURIComponent(topicUrl);
  const pad  = 30;
  for (const hub of HUBS) {
    const r     = await httpPost(hub, body);
    const label = hub.replace('https://', '').replace(/\/$/, '');
    const ok    = r.status === 204 || r.status === 200;
    console.log('    ' + label.padEnd(pad) + ' HTTP ' + r.status + (ok ? ' OK' : ''));
  }
}

// ─── Ping sitemap ─────────────────────────────────────────────────────────────

async function pingSitemaps() {
  console.log('Sitemap pings:');
  const gr = await httpGet('https://www.google.com/ping?sitemap=' + encodeURIComponent(SITEMAP));
  console.log('  Google : HTTP ' + gr.status + (gr.status === 200 ? ' OK' : ''));
  const br = await httpGet('https://www.bing.com/ping?sitemap=' + encodeURIComponent(SITEMAP));
  console.log('  Bing   : HTTP ' + br.status + (br.status === 200 ? ' OK' : ''));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args        = process.argv.slice(2);
  const hours       = args.includes('--hours')    ? parseInt(args[args.indexOf('--hours') + 1]) : 24;
  const single      = args.includes('--slug')     ? args[args.indexOf('--slug') + 1] : null;
  const sitemapOnly = args.includes('--sitemap');
  const allFeeds    = args.includes('--all-feeds');

  if (sitemapOnly) {
    await pingSitemaps();
    return;
  }

  const prisma = new PrismaClient();
  try {
    let posts = [];

    if (single) {
      const p = await prisma.post.findUnique({
        where:  { slug: single, status: 'published' },
        select: { slug: true, title: true },
      });
      if (!p) { console.error('Post not found or not published: ' + single); process.exit(1); }
      posts = [p];
    } else {
      const since = new Date(Date.now() - hours * 3600 * 1000);
      posts = await prisma.post.findMany({
        where:   { status: 'published', createdAt: { gte: since } },
        select:  { slug: true, title: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    console.log('New posts (last ' + hours + 'h): ' + posts.length);

    // Decide which feeds to ping
    const feedsToPing = [];
    if (allFeeds || posts.length > 0) {
      // If posts exist in specific languages, ping those feeds; otherwise ping EN
      if (allFeeds) {
        for (const lang of LANGUAGES) {
          feedsToPing.push({ lang, url: lang === 'en' ? FEED_URL : FEED_URL + '?lang=' + lang });
        }
      } else {
        feedsToPing.push({ lang: 'en', url: FEED_URL });
      }
    }

    if (feedsToPing.length > 0) {
      console.log('\nWebSub hub pings:');
      for (const feed of feedsToPing) {
        console.log('  Feed [' + feed.lang + ']: ' + feed.url);
        await pingTopic(feed.url);
      }
    } else {
      console.log('No new posts — pinging sitemap only.');
    }

    console.log('');
    await pingSitemaps();

    if (posts.length > 0) {
      console.log('\nPinged for posts:');
      for (const p of posts.slice(0, 10)) {
        console.log('  ' + BASE + '/blog/' + p.slug);
      }
      if (posts.length > 10) console.log('  ... and ' + (posts.length - 10) + ' more');
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
