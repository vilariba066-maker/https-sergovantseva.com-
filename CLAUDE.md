# CLAUDE.md — sergovantseva.com Blog Agent Rules

## Section 4.5 — SEO Rules, Anti-Detect Words, Languages

---

### 4.5.1 Supported Languages

The blog publishes content in 20 languages. Language codes match the `lang` column in `post_translations`:

| Code | Language   | Code | Language    |
|------|-----------|------|-------------|
| `en` | English   | `sv` | Swedish     |
| `ru` | Russian   | `da` | Danish      |
| `de` | German    | `fi` | Finnish     |
| `fr` | French    | `el` | Greek       |
| `es` | Spanish   | `tr` | Turkish     |
| `it` | Italian   | `ja` | Japanese    |
| `pt` | Portuguese| `ko` | Korean      |
| `nl` | Dutch     | `zh` | Chinese     |
| `pl` | Polish    | `ar` | Arabic      |
| `cs` | Czech     | `uk` | Ukrainian   |

---

### 4.5.2 SEO Rules

**Indexing (robots):**
- `noindex` when: translation title equals original post title (fake/untranslated)
- `noindex` when: content word count < 300
- English posts: always indexed (unless explicitly drafted)
- hreflang only included when: `isReal = true` AND `sitemapAt IS NOT NULL` AND `title ≠ original`

**Canonical URLs:**
- English: `https://sergovantseva.com/blog/{slug}`
- Other languages: `https://sergovantseva.com/{lang}/blog/{slug}`
- `x-default` always points to English URL

**Sitemap:**
- `sitemap.ts` excludes translations where `isReal = false` OR `sitemapAt IS NULL`
- Translation slug used when available (`post_translations.slug` overrides `posts.slug`)
- Sitemap index: `public/sitemaps/trans-index.xml` with subtiles `trans-1.xml` … `trans-N.xml`

**Internal links:**
- Insert with `class="internal-link"`
- Maximum 5 per post
- Never link a post to itself
- Never add duplicate links to the same target within a post

**External links:**
- Always add `rel="nofollow"` to outbound links (except `sergovantseva.com`)
- Script: `node scripts/content-improver.js --fix-nofollow`

**Content minimums (quality-gate thresholds):**
- Title: 30–70 characters
- Excerpt/meta description: 100–165 characters
- Word count: ≥ 300 words
- At least 1 H2 heading
- At least 1 internal link
- Featured image required

---

### 4.5.3 Anti-Detect Words (AI Content Flags)

Avoid these words/phrases in generated or translated content — they are high-frequency AI detector triggers:

**Overused verbs / transitions:**
`delve`, `delves`, `delving`, `embark`, `harness`, `leverage`, `utilize`, `underscore`, `underscores`

**Vague intensifiers:**
`crucial`, `pivotal`, `paramount`, `invaluable`, `indispensable`, `transformative`, `groundbreaking`, `revolutionary`, `game-changing`

**AI filler phrases:**
- "it is important to note"
- "it's worth noting"
- "in conclusion"
- "in summary"
- "furthermore" (when used as a crutch)
- "moreover"
- "as previously mentioned"
- "needless to say"
- "it goes without saying"

**Hollow adjectives:**
`comprehensive`, `robust`, `intricate`, `nuanced`, `multifaceted`, `holistic`, `seamless`, `streamlined`

**AI-specific constructions:**
- "not only … but also" (overused pattern)
- "in today's fast-paced world"
- "in the ever-evolving landscape"
- "at the end of the day"
- "moving forward"

**Translation-specific (RU/DE/FR etc.):**
- Avoid overly formal register in dating/relationship content
- Prefer colloquial equivalents over literal translations of the above phrases

---

### 4.5.4 Year Freshness

- Replace stale years in patterns like "in 2022", "as of 2021", "since 2020"
- Use `node scripts/content-improver.js --fix-years` to automate
- Current year reference: 2026

---

### 4.5.5 Translation Quality

- `isRealTranslation()` rejects if: exact match to original, similarity > 70%, or result < 20% of original length
- Fake translations: set `isReal = false`, `sitemapAt = null`
- Real translations on save: `isReal = true`, `sitemapAt = new Date()`, `translatedAt = new Date()`
- API: WowaTranslate — `POST https://app.wowaitranslate.com/v2/translate`
  - Auth: `Authorization: DeepL-Auth-Key $WOWA_API_KEY`
  - Body: `{"text": ["..."], "target_lang": "RU"}`
  - Response: `data.translations[0].text`

---

### 4.5.6 Scripts Reference

| Script | Purpose |
|--------|---------|
| `node scripts/translate-remaining.js --stats` | Translation coverage |
| `node scripts/translate-remaining.js --seo-only --batch=100` | Translate excerpt/seo fields |
| `node scripts/quality-gate.js --failing` | Posts with quality issues |
| `node scripts/content-improver.js --stats` | Year/nofollow stats |
| `node scripts/auto-linker.js --dry-run` | Preview internal link insertions |
| `node scripts/retranslate-fakes.js --check` | Find fake translations |
| `node scripts/sitemap-gate.js --generate --submit` | Rebuild & submit sitemaps |

---

### 4.5.7 Environment

- **Server:** `root@137.184.177.72`
- **App dir:** `/var/www/nextblog`
- **Process manager:** pm2 (`pm2 restart nextblog`)
- **DB:** PostgreSQL `blogdb` via Prisma (`prisma/schema.prisma`)
- **Node:** 22.22.2 · Next.js 16.2.3 · Prisma 5.22.0

<!-- auto-generated: 2026-04-15 -->
