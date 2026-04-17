'use strict';
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const blacklists = JSON.parse(fs.readFileSync('scripts/config/ai_blacklists.json'));
const tier2 = blacklists.tier2_ai_words;

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').toLowerCase();
}

async function run() {
  const posts = await prisma.post.findMany({
    where: { status: 'published' },
    select: { slug: true, content: true },
  });

  console.log('Scanning ' + posts.length + ' posts for ' + tier2.length + ' tier2_ai_words...\n');

  const hitMap = {};
  const postHits = [];

  for (const post of posts) {
    const text = stripHtml(post.content);
    const found = [];
    for (const word of tier2) {
      const re = new RegExp('\\b' + word.replace('-', '[-\\s]') + '\\b', 'gi');
      if (re.test(text)) found.push(word);
    }
    if (found.length > 0) {
      postHits.push({ slug: post.slug, words: found, count: found.length });
      for (const w of found) hitMap[w] = (hitMap[w] || 0) + 1;
    }
  }

  const sep = '='.repeat(52);
  console.log(sep);
  console.log('Posts with >= 1 tier2 hit : ' + postHits.length + ' / ' + posts.length +
    ' (' + ((postHits.length / posts.length) * 100).toFixed(1) + '%)');
  console.log('Posts clean               : ' + (posts.length - postHits.length));
  console.log('');

  const sorted = Object.entries(hitMap).sort((a, b) => b[1] - a[1]);
  console.log('Top tier2 words by post count:');
  for (const [word, count] of sorted.slice(0, 15)) {
    console.log('  ' + word.padEnd(22) + count + ' posts');
  }

  const dist = {};
  for (const p of postHits) dist[p.count] = (dist[p.count] || 0) + 1;
  console.log('\nHits-per-post distribution:');
  for (const [n, c] of Object.entries(dist).sort((a, b) => +a[0] - +b[0])) {
    console.log('  ' + String(n).padStart(2) + ' word(s) : ' + c + ' posts');
  }

  const worst = postHits.sort((a, b) => b.count - a.count).slice(0, 10);
  console.log('\nTop 10 worst posts:');
  for (const p of worst) {
    console.log('  [' + p.count + '] ' + p.slug.slice(0, 62));
    console.log('      ' + p.words.join(', '));
  }

  await prisma.$disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
