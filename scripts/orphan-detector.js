#!/usr/bin/env node
/**
 * orphan-detector.js — Finds posts with no inbound internal links
 *
 * A page is "orphaned" when no other published post links to it.
 * Orphans are invisible to Google's link graph and bad for internal PageRank.
 *
 * Usage:
 *   node scripts/orphan-detector.js              # Full report (orphans = 0 inbound)
 *   node scripts/orphan-detector.js --min 2      # Posts with < 2 inbound links
 *   node scripts/orphan-detector.js --top 50     # Limit output to 50 rows
 *   node scripts/orphan-detector.js --csv        # CSV to stdout
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

function extractLinkedSlugs(html) {
  const slugs = new Set();
  const re = /href=["']\/blog\/([^"'/?#\s]+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) slugs.add(m[1]);
  return slugs;
}

async function main() {
  const args = process.argv.slice(2);
  const top  = args.includes('--top') ? parseInt(args[args.indexOf('--top')  + 1]) : 0;
  const min  = args.includes('--min') ? parseInt(args[args.indexOf('--min')  + 1]) : 1;
  const csv  = args.includes('--csv');

  const prisma = new PrismaClient();
  try {
    const posts = await prisma.post.findMany({
      where:   { status: 'published' },
      select:  { slug: true, title: true, content: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Tally inbound links for every slug
    const inbound = {};
    for (const p of posts) inbound[p.slug] = 0;

    for (const p of posts) {
      for (const slug of extractLinkedSlugs(p.content || '')) {
        if (slug in inbound) inbound[slug]++;
      }
    }

    const orphans = posts.filter(p => inbound[p.slug] === 0);

    // Under-threshold posts (includes orphans when min > 1)
    let weak = posts
      .filter(p => inbound[p.slug] < min)
      .sort((a, b) => inbound[a.slug] - inbound[b.slug] || new Date(a.createdAt) - new Date(b.createdAt));

    if (top) weak = weak.slice(0, top);

    // Distribution
    const dist = { 0: 0, 1: 0, '2-5': 0, '6-10': 0, '11+': 0 };
    for (const p of posts) {
      const n = inbound[p.slug];
      if      (n === 0)  dist[0]++;
      else if (n === 1)  dist[1]++;
      else if (n <= 5)   dist['2-5']++;
      else if (n <= 10)  dist['6-10']++;
      else               dist['11+']++;
    }

    // Top 10 most-linked
    const topLinked = [...posts]
      .sort((a, b) => inbound[b.slug] - inbound[a.slug])
      .slice(0, 10);

    if (csv) {
      console.log('slug,inbound_links,title,published');
      for (const p of weak) {
        const date  = new Date(p.createdAt).toISOString().slice(0, 10);
        const title = (p.title || '').replace(/,/g, ';').replace(/"/g, "'");
        console.log(p.slug + ',' + inbound[p.slug] + ',"' + title + '",' + date);
      }
      return;
    }

    console.log('\nOrphan / Under-linked Page Report');
    console.log('='.repeat(56));
    console.log('Total posts    : ' + posts.length);
    console.log('Orphans (0)    : ' + orphans.length + ' (' + (orphans.length / posts.length * 100).toFixed(1) + '%)');
    if (min > 1) {
      console.log('Under-linked   : ' + weak.length + ' (< ' + min + ' inbound links)');
    }
    console.log('');

    console.log('Inbound link distribution:');
    for (const [range, count] of Object.entries(dist)) {
      const bar = '█'.repeat(Math.round(count / posts.length * 40));
      console.log('  ' + String(range).padStart(5) + ' links : ' + String(count).padStart(4) + '  ' + bar);
    }

    console.log('\nTop 10 most-linked posts:');
    for (const p of topLinked) {
      console.log('  ' + String(inbound[p.slug]).padStart(4) + '  ' + p.slug);
    }

    const label = min > 1 ? 'under-linked (< ' + min + ')' : 'orphan';
    console.log('\n' + label.charAt(0).toUpperCase() + label.slice(1) + ' posts' + (top ? ' (top ' + top + ')' : '') + ':');
    for (const p of weak) {
      const date = new Date(p.createdAt).toISOString().slice(0, 10);
      console.log('  [' + String(inbound[p.slug]).padStart(2) + '] ' + p.slug.padEnd(58) + ' ' + date);
    }

    console.log('');
    console.log('Tip: run auto-linker --run to add inbound links automatically.');
    console.log('     Or target specific posts: node scripts/auto-linker.js --slug <slug>');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
