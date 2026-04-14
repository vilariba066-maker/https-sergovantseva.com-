#!/usr/bin/env node
/**
 * quality-gate.js — Pre-publication content quality checker
 *
 * Usage:
 *   node scripts/quality-gate.js --all            # Audit all published posts
 *   node scripts/quality-gate.js --drafts         # Check drafts before publish
 *   node scripts/quality-gate.js --slug my-post   # Single post
 *   node scripts/quality-gate.js --failing        # Show only posts with issues
 *   node scripts/quality-gate.js --json           # JSON output (CI/scripts)
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

// ─── Rules ────────────────────────────────────────────────────────────────────

const RULES = {
  title:         { min: 30, max: 70 },
  excerpt:       { min: 100, max: 165 },
  wordCount:     { min: 300 },
  h2:            { min: 1 },
  internalLinks: { min: 1 },
  featuredImage: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(html) {
  const text = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

function countTags(html, tag) {
  return ((html || '').match(new RegExp('<' + tag + '[\\s>]', 'gi')) || []).length;
}

function countInternalLinks(html) {
  return ((html || '').match(/href=["']\/blog\//gi) || []).length;
}

// ─── Check one post ───────────────────────────────────────────────────────────

function checkPost(post) {
  const issues  = [];
  const title   = (post.title   || '').trim();
  const excerpt = (post.excerpt || '').trim();
  const content =  post.content || '';

  if (!title)
    issues.push('missing title');
  else if (title.length < RULES.title.min)
    issues.push('title too short (' + title.length + ' chars, min ' + RULES.title.min + ')');
  else if (title.length > RULES.title.max)
    issues.push('title too long (' + title.length + ' chars, max ' + RULES.title.max + ')');

  if (!excerpt)
    issues.push('missing excerpt (meta description)');
  else if (excerpt.length < RULES.excerpt.min)
    issues.push('excerpt too short (' + excerpt.length + ' chars, min ' + RULES.excerpt.min + ')');
  else if (excerpt.length > RULES.excerpt.max)
    issues.push('excerpt too long (' + excerpt.length + ' chars, max ' + RULES.excerpt.max + ')');

  const wc = wordCount(content);
  if (wc < RULES.wordCount.min)
    issues.push('thin content (' + wc + ' words, min ' + RULES.wordCount.min + ')');

  if (countTags(content, 'h2') < RULES.h2.min)
    issues.push('no H2 headings');

  if (countInternalLinks(content) < RULES.internalLinks.min)
    issues.push('no internal links');

  if (!post.featuredImage)
    issues.push('no featured image');

  return issues;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args        = process.argv.slice(2);
  const failingOnly = args.includes('--failing');
  const jsonOut     = args.includes('--json');
  const drafts      = args.includes('--drafts');
  const single      = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

  if (!args.includes('--all') && !drafts && !single && !failingOnly) {
    console.log('Usage:');
    console.log('  node scripts/quality-gate.js --all            All published posts');
    console.log('  node scripts/quality-gate.js --drafts         Draft posts');
    console.log('  node scripts/quality-gate.js --slug <slug>    Single post');
    console.log('  node scripts/quality-gate.js --failing        Failing posts only');
    console.log('  node scripts/quality-gate.js --json           JSON output');
    return;
  }

  const prisma = new PrismaClient();
  try {
    let where;
    if (single)      where = { slug: single };
    else if (drafts) where = { status: 'draft' };
    else             where = { status: 'published' };

    const posts = await prisma.post.findMany({
      where,
      select:  { slug: true, title: true, excerpt: true, content: true, featuredImage: true },
      orderBy: { createdAt: 'desc' },
    });

    const results = posts.map(p => ({ slug: p.slug, title: p.title, issues: checkPost(p) }));
    const passing = results.filter(r => r.issues.length === 0);
    const failing = results.filter(r => r.issues.length >  0);

    if (jsonOut) {
      console.log(JSON.stringify({
        summary: { total: posts.length, passing: passing.length, failing: failing.length },
        failing,
        passing: passing.map(r => r.slug),
      }, null, 2));
      return;
    }

    console.log('\nQuality Gate Report');
    console.log('='.repeat(56));
    console.log('Total   : ' + posts.length);
    console.log('Passing : ' + passing.length + ' (' + (passing.length / posts.length * 100).toFixed(1) + '%)');
    console.log('Failing : ' + failing.length);
    console.log('');

    if (failing.length === 0) {
      console.log('All posts pass quality checks!');
      return;
    }

    // Issue frequency summary
    const freq = {};
    for (const r of failing) {
      for (const issue of r.issues) {
        const key = issue.replace(/\d+ (chars|words)/g, 'N $1');
        freq[key] = (freq[key] || 0) + 1;
      }
    }
    console.log('Issue breakdown:');
    for (const [issue, count] of Object.entries(freq).sort((a, b) => b[1] - a[1])) {
      console.log('  ' + String(count).padStart(5) + '  ' + issue);
    }

    if (single || failingOnly || posts.length <= 50) {
      console.log('\nPost details:');
      for (const r of failing) {
        console.log('\n  [' + r.slug + ']');
        for (const issue of r.issues) console.log('    x ' + issue);
      }
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
