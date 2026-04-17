'use strict';
/**
 * fix_tawkify_v2.js
 * Aggressive cleanup for 72 posts still containing "Tawkify".
 * Strategy (in order):
 *   1. Remove entire <h2> sections whose heading text contains "tawkify"
 *      (heading + all content until the next <h2> or end)
 *   2. Remove entire <p> blocks that contain "tawkify"
 *   3. Remove entire <li> items that contain "tawkify"
 *   4. Strip ", per tawkify.com" references left in remaining text
 *   5. Clean up empty wrappers (<ul>, <ol>, <p>)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry-run');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Remove <h2> sections whose heading contains "tawkify".
 * Split on <h2 boundaries; any part whose leading <h2> contains "tawkify"
 * is dropped entirely (heading + everything until the next <h2>).
 */
function removeTawkifyH2Sections(html) {
  // Split preserving the <h2 delimiter at the start of each part
  const parts = html.split(/(?=<h2\b)/i);
  return parts.filter(part => {
    const h2Match = part.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2Match && /tawkify/i.test(h2Match[0])) {
      return false; // Drop section
    }
    return true;
  }).join('');
}

/**
 * Remove entire <p> blocks containing "tawkify".
 */
function removeTawkifyParagraphs(html) {
  return html.replace(/<p[^>]*>[\s\S]*?tawkify[\s\S]*?<\/p>/gi, '');
}

/**
 * Remove entire <li> items containing "tawkify".
 */
function removeTawkifyListItems(html) {
  return html.replace(/<li[^>]*>[\s\S]*?tawkify[\s\S]*?<\/li>/gi, '');
}

/**
 * Strip ", per tawkify.com" and "per tawkify.com," references
 * (these show up in sentences like "…, per tawkify.com, but…")
 */
function stripTawkifyDomain(html) {
  return html
    .replace(/,?\s*per\s+tawkify\.com\s*,?/gi, '')
    .replace(/\btawkify\.com\b/gi, ''); // catch any bare domain left
}

/**
 * Clean up structural debris: empty lists, empty paragraphs, excess newlines.
 */
function cleanUp(html) {
  return html
    .replace(/<ul[^>]*>\s*<\/ul>/gi, '')
    .replace(/<ol[^>]*>\s*<\/ol>/gi, '')
    .replace(/<p[^>]*>\s*<\/p>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function removeTawkify(html) {
  if (!html) return html;
  let result = html;
  result = removeTawkifyH2Sections(result);
  result = removeTawkifyParagraphs(result);
  result = removeTawkifyListItems(result);
  result = stripTawkifyDomain(result);
  result = cleanUp(result);
  return result;
}

// ── verify no Tawkify remains ─────────────────────────────────────────────────

function containsTawkify(html) {
  return /tawkify/i.test((html || '').replace(/<[^>]+>/g, ' '));
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Mode: ' + (DRY ? 'DRY RUN' : 'LIVE') + '\n');

  const posts = await prisma.post.findMany({
    where: { status: 'published', content: { contains: 'Tawkify', mode: 'insensitive' } },
    select: { id: true, slug: true, content: true },
  });

  console.log('Posts with Tawkify: ' + posts.length);
  let fixed = 0, residual = 0, noChange = 0;

  for (const post of posts) {
    const cleaned = removeTawkify(post.content);
    if (cleaned === post.content) {
      console.log('  · ' + post.slug.slice(0, 60) + ' (no change — investigate manually)');
      noChange++;
      continue;
    }
    const stillHas = containsTawkify(cleaned);
    const removedChars = post.content.length - cleaned.length;
    const status = stillHas ? '⚠' : '✓';
    console.log('  ' + status + ' ' + post.slug.slice(0, 60) + ' (-' + removedChars + ' chars' + (stillHas ? ', RESIDUAL TAWKIFY' : '') + ')');
    if (!DRY) {
      await prisma.post.update({ where: { id: post.id }, data: { content: cleaned, updatedAt: new Date() } });
    }
    if (stillHas) residual++; else fixed++;
  }

  console.log('\n' + '─'.repeat(55));
  console.log('Fully cleaned  : ' + fixed);
  console.log('Residual (warn): ' + residual);
  console.log('No change      : ' + noChange);
  if (DRY) console.log('\n[DRY RUN] No writes. Remove --dry-run to apply.');

  await prisma.$disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
