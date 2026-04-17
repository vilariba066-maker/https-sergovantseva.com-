'use strict';
/**
 * diagnose_tawkify.js
 * Show context around every remaining Tawkify mention in posts.
 * This reveals why sentence-regex failed (e.g. no terminal punctuation,
 * mid-HTML-tag, inside <li>, inside <a href>, etc.)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

// Extract 120 chars of plain text around each Tawkify match
function getContexts(html) {
  const text = stripHtml(html);
  const contexts = [];
  const re = /tawkify/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 80);
    const end = Math.min(text.length, m.index + 80);
    contexts.push('…' + text.slice(start, end).trim() + '…');
  }
  return contexts;
}

// Also show the raw HTML snippet (60 chars each side)
function getRawHtmlContext(html) {
  const contexts = [];
  const re = /tawkify/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const start = Math.max(0, m.index - 60);
    const end = Math.min(html.length, m.index + 60);
    contexts.push(html.slice(start, end).replace(/\n/g, '↵'));
  }
  return contexts;
}

async function main() {
  const posts = await prisma.post.findMany({
    where: { status: 'published', content: { contains: 'Tawkify', mode: 'insensitive' } },
    select: { id: true, slug: true, content: true },
  });

  console.log('Posts still containing Tawkify: ' + posts.length + '\n');
  console.log('='.repeat(70));

  for (const post of posts) {
    const textCtxs = getContexts(post.content);
    const htmlCtxs = getRawHtmlContext(post.content);
    console.log('\nSLUG: ' + post.slug);
    console.log('  Occurrences: ' + textCtxs.length);
    textCtxs.forEach((ctx, i) => {
      console.log('  [text ' + (i+1) + '] ' + ctx);
      console.log('  [html ' + (i+1) + '] ' + htmlCtxs[i]);
    });
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
