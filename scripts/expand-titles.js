'use strict';
/**
 * expand-titles.js — One-shot: expand all post titles under 30 chars
 * Uses the slug + title to generate a compelling SEO title (≤65 chars).
 * Usage:
 *   node expand-titles.js           dry-run (default)
 *   node expand-titles.js --run     apply to DB
 */

const { PrismaClient } = require('@prisma/client');
const YEAR = 2026;
const MAX  = 65;
const args = process.argv.slice(2);
const DRY  = !args.includes('--run');

// ─── Suffix templates keyed by slug keyword ───────────────────────────────────
function suffix(slug) {
  const s = slug.toLowerCase();

  // Brand / person pages
  if (s === 'soulmatcher-app')                return ': AI-Powered Matchmaking App & Features';
  if (s === 'soulmatcher-vip-concierge')      return ': Elite VIP Matchmaking Concierge Service';
  if (s === 'soulmatcher-founder-natalia')    return ' Sergovantseva: Relationship Coach & Founder';
  if (s === 'natalia-matchmaking-expert')     return ': Expert Matchmaker & Relationship Coach';
  if (s === 'natalia-sergovantseva-coach')    return ': Relationship Coach Helping You Find Love';
  if (s === 'matchmaking-mentor-natalia')     return ': Personal Matchmaking Mentor & Coach';
  if (s === 'phd-psychology-coach')           return ': Psychology-Backed Relationship Coaching';

  // Programs & courses
  if (s.includes('happy-relationships'))      return ': Complete Online Program & What to Expect';
  if (s.includes('course') || s.includes('program') || s.includes('training')) {
    if (s.includes('matchmaking') || s.includes('matchmaker'))
                                              return ': Professional Certification & Training ' + YEAR;
    if (s.includes('online'))                 return ': Online Program for Real Relationship Results';
    return ': Complete Program, Modules & Results ' + YEAR;
  }

  // Coaching (specific cities / formats)
  if (s.includes('coach') && (s.includes('london') || s.includes('zoom') || s.includes('online')))
                                              return ': Expert Online & In-Person Coaching ' + YEAR;
  if (s.includes('coach') && s.includes('dating'))
                                              return ': Expert Tips to Transform Your Love Life ' + YEAR;
  if (s.includes('coach') && s.includes('relationship'))
                                              return ': Build the Relationship You Deserve ' + YEAR;
  if (s.includes('coaching'))                 return ': How It Works & What to Expect ' + YEAR;
  if (s.includes('coach'))                    return ': Expert Guidance for Better Relationships ' + YEAR;

  // Matchmaking
  if (s.includes('matchmaking') || s.includes('matchmaker'))
                                              return ': How Professional Matchmaking Works ' + YEAR;

  // Topic-specific expansions
  if (s.includes('attachment'))               return ': Understand Your Love Style & Heal ' + YEAR;
  if (s.includes('resentment') && s.includes('healing'))
                                              return ': Steps to Let Go & Reconnect ' + YEAR;
  if (s.includes('resentment'))               return ': Why It Builds & How to Release It ' + YEAR;
  if (s.includes('breakup'))                  return ': Stages, Healing & Moving Forward ' + YEAR;
  if (s.includes('loneliness') || s.includes('lonely'))
                                              return ': How to Feel Connected & Find Love ' + YEAR;
  if (s.includes('family-pattern') || s.includes('reprogramming'))
                                              return ': Break the Cycle for Healthier Love ' + YEAR;
  if (s.includes('forgiveness'))              return ': How to Forgive & Rebuild Trust ' + YEAR;
  if (s.includes('baggage'))                  return ': How to Let Go & Love Fully Again ' + YEAR;
  if (s.includes('profile'))                  return ': Write One That Actually Gets Replies ' + YEAR;
  if (s.includes('communication') || s.includes('listening') || s.includes('i-statement'))
                                              return ': Techniques That Deepen Connection ' + YEAR;
  if (s.includes('ai-') || s.includes('-ai') || s.includes('filter'))
                                              return ': How It Works & What It Means for Dating ' + YEAR;
  if (s.includes('red-flag'))                 return ': 15 Warning Signs You Should Never Ignore ' + YEAR;
  if (s.includes('pitfall') || s.includes('mistake') || s.includes('avoid'))
                                              return ': Mistakes to Avoid for Better Results ' + YEAR;
  if (s.includes('belief'))                   return ': Rewrite Limiting Beliefs About Love ' + YEAR;
  if (s.includes('cultural') || s.includes('conflict'))
                                              return ': Bridge Differences & Build Harmony ' + YEAR;
  if (s.includes('single'))                   return ': Thrive Solo & Attract Real Love ' + YEAR;
  if (s.includes('quality') && s.includes('quantity'))
                                              return ': Why Fewer Dates Lead to More Love ' + YEAR;
  if (s.includes('strategic') || s.includes('strategy') || s.includes('approach'))
                                              return ': A Smarter Way to Find Lasting Love ' + YEAR;
  if (s.includes('modern'))                   return ': Navigate Today\'s Dating World with Confidence';
  if (s.includes('first-message'))            return ': Examples That Actually Get Replies ' + YEAR;
  if (s.includes('online-to-offline'))        return ': Turn Matches into Real Dates ' + YEAR;
  if (s.includes('online') && s.includes('dating'))
                                              return ': Succeed Online & Find Real Love ' + YEAR;

  // Catch-all by category
  if (s.includes('dating'))                   return ': Expert Advice for Modern Relationships ' + YEAR;
  if (s.includes('relationship'))             return ': Build Deeper, Lasting Connections ' + YEAR;

  return ': Complete Guide & Expert Tips ' + YEAR;
}

function expand(slug, title) {
  const base = title.trim();
  const sfx  = suffix(slug);

  // Try full suffix
  let candidate = base + sfx;
  if (candidate.length <= MAX) return candidate;

  // Drop the year from the suffix and retry
  candidate = (base + sfx).replace(/ \d{4}$/, '');
  if (candidate.length <= MAX) return candidate;

  // Short universal suffix
  candidate = base + ': Expert Guide ' + YEAR;
  if (candidate.length <= MAX) return candidate;

  // Just the year in parens
  candidate = base + ' (' + YEAR + ')';
  if (candidate.length <= MAX) return candidate;

  return base; // already expanded elsewhere or unmatchable
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const prisma = new PrismaClient();
  try {
    const posts = await prisma.$queryRaw`
      SELECT id, slug, title
      FROM posts
      WHERE length(title) < 30
        AND status = 'published'
      ORDER BY length(title) ASC
    `;

    console.log('Posts to expand : ' + posts.length + (DRY ? '  [DRY RUN]' : '') + '\n');

    let changed = 0;
    for (const post of posts) {
      const newTitle = expand(post.slug, post.title);
      const ok = newTitle !== post.title;
      const len = newTitle.length;

      console.log((ok ? '✓' : '·') + ' [' + String(len).padStart(2) + '] ' +
        '"' + post.title + '"');
      if (ok) console.log('      → "' + newTitle + '"');

      if (ok && !DRY) {
        await prisma.post.update({ where: { id: post.id }, data: { title: newTitle } });
        changed++;
      } else if (ok) {
        changed++;
      }
    }

    console.log('\n─'.repeat(55));
    console.log('Titles expanded : ' + changed + ' / ' + posts.length);
    if (DRY) console.log('[DRY RUN] No writes. Add --run to apply.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
