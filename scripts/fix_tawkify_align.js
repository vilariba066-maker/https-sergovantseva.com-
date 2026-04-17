'use strict';
/**
 * fix_tawkify_align.js
 * 1. Remove sentences containing "Tawkify" from all 98 affected posts
 * 2. Replace "align with this" → "support this" across all posts
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry-run');

// ── helpers ──────────────────────────────────────────────────────────────────

function stripHtmlText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Remove sentences containing "tawkify" (case-insensitive) from HTML content.
 * Strategy:
 *   1. Split on </p> boundaries to get paragraph chunks.
 *   2. For each chunk, strip the Tawkify sentence(s) at text level.
 *   3. If remaining text is < 25 chars, drop the whole <p>.
 *   4. Clean up empty <p> tags and extra blank lines.
 */
function removeTawkifySentences(html) {
  if (!html) return html;

  // Split into <p>...</p> blocks + non-p content
  // We'll process sentence-by-sentence within each paragraph's text
  let result = html;

  // Remove whole <p> blocks that are entirely Tawkify
  result = result.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) => {
    const text = stripHtmlText(inner);
    if (!text) return match;
    if (/tawkify/i.test(text)) {
      // Try removing just Tawkify sentences
      // A sentence ends at . ! ? followed by space/newline/tag or end of string
      const cleaned = inner.replace(
        /[^<.!?]*[Tt]awkify[^<.!?]*(?:[.!?]+(?:\s|<|$)|$)/g,
        ' '
      ).trim();
      const cleanedText = stripHtmlText(cleaned);
      if (cleanedText.length < 25) {
        return ''; // Drop entire paragraph
      }
      return match.replace(inner, cleaned);
    }
    return match;
  });

  // Also catch Tawkify outside <p> tags (e.g. in <li>, standalone text)
  result = result.replace(
    /[^<.!?]*[Tt]awkify[^<.!?]*(?:[.!?]+(?:\s|<|$)|$)/g,
    ' '
  );

  // Clean up: remove empty <p> tags, collapse excess whitespace/newlines
  result = result
    .replace(/<p[^>]*>\s*<\/p>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return result;
}

/**
 * Replace "align with this" (case-insensitive, various forms) → "support this"
 */
function replaceAlignPhrase(html) {
  if (!html) return html;
  return html
    .replace(/\balign(?:s|ed|ing)? with this\b/gi, 'support this')
    .replace(/\balign(?:s|ed|ing)? with these\b/gi, 'support these');
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Mode: ' + (DRY ? 'DRY RUN' : 'LIVE') + '\n');

  // ── 1. Tawkify removal ────────────────────────────────────────────────────
  const tawkifyPosts = await prisma.post.findMany({
    where: { status: 'published', content: { contains: 'Tawkify', mode: 'insensitive' } },
    select: { id: true, slug: true, content: true },
  });

  console.log('── Step 1: Tawkify sentence removal (' + tawkifyPosts.length + ' posts) ──');
  let tawkifyFixed = 0;

  for (const post of tawkifyPosts) {
    const cleaned = removeTawkifySentences(post.content);
    if (cleaned === post.content) {
      console.log('  · ' + post.slug.slice(0, 60) + ' (no change)');
      continue;
    }
    const removedChars = post.content.length - cleaned.length;
    console.log('  ✓ ' + post.slug.slice(0, 60) + ' (-' + removedChars + ' chars)');
    if (!DRY) {
      await prisma.post.update({ where: { id: post.id }, data: { content: cleaned, updatedAt: new Date() } });
    }
    tawkifyFixed++;
  }

  // ── 2. "align with this" replacement ─────────────────────────────────────
  const alignPosts = await prisma.post.findMany({
    where: { status: 'published', content: { contains: 'align with this', mode: 'insensitive' } },
    select: { id: true, slug: true, content: true },
  });

  console.log('\n── Step 2: "align with this" → "support this" (' + alignPosts.length + ' posts) ──');
  let alignFixed = 0;

  for (const post of alignPosts) {
    const fixed = replaceAlignPhrase(post.content);
    if (fixed === post.content) continue;
    const count = (post.content.match(/\balign(?:s|ed|ing)? with this\b/gi) || []).length;
    console.log('  ✓ ' + post.slug.slice(0, 60) + ' (' + count + ' replacement' + (count > 1 ? 's' : '') + ')');
    if (!DRY) {
      await prisma.post.update({ where: { id: post.id }, data: { content: fixed, updatedAt: new Date() } });
    }
    alignFixed++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55));
  console.log('Tawkify posts cleaned  : ' + tawkifyFixed + ' / ' + tawkifyPosts.length);
  console.log('"align with this" fixed: ' + alignFixed + ' / ' + alignPosts.length);
  if (DRY) console.log('\n[DRY RUN] No writes. Remove --dry-run to apply.');

  await prisma.$disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
