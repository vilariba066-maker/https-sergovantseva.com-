# sergovantseva.com — Next.js Blog

Personal website and blog of **Natalia Sergovantseva**, Relationship Coach.

## Tech Stack

- **Framework**: Next.js 16 (App Router, SSG)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Styles**: Tailwind CSS + inline styles
- **Server**: DigitalOcean VPS (Debian), nginx + PM2
- **Fonts**: Georgia/Times New Roman (system), DM Sans (self-hosted woff2)

## Project Structure

```
app/
  page.tsx                   # Homepage (EN)
  layout.tsx                 # Root layout — dynamic html[lang], JSON-LD
  globals.css                # Global styles
  robots.ts                  # Dynamic robots.txt
  sitemap.ts                 # Dynamic sitemap with hreflang alternates
  blog/
    page.tsx                 # EN blog listing
    [slug]/page.tsx          # EN post page
  [lang]/
    page.tsx                 # Redirects /{lang} → /{lang}/blog
    blog/
      page.tsx               # Localized blog listing (ru/de/fr/…)
      [slug]/page.tsx        # Localized post page

components/
  Header.tsx                 # Navigation + language switcher
  Footer.tsx
  LangSwitcher.tsx           # hreflang-aware language selector
  AnimateOnScroll.tsx        # Intersection Observer scroll animations
  SplashScreen.tsx

lib/
  db.ts                      # Prisma client singleton
  i18n.ts                    # Language codes, path helpers (blogPath, postPath)
  metadata.ts                # SEO helpers — generateMetadata for posts/blog

prisma/
  schema.prisma              # Post, PostTranslation, Category models
  migrations/                # Database migrations
```

## Supported Languages

EN, RU, DE, FR, ES, IT, PL, PT, TR, UK, EL (11 languages)

URL pattern:
- English: `/blog/[slug]`
- Others:  `/[lang]/blog/[slug]`

## Database Models

- **Post** — title, content, excerpt, featuredImage, seoTitle, seoDescription, slug
- **PostTranslation** — per-language: title, excerpt, content, slug, seoTitle, seoDescription
- **Category** — name, slug (many-to-many with Post)

## SEO Features

- Dynamic `sitemap.xml` with hreflang alternates for all 11 languages
- Dynamic `robots.txt`
- Self-referencing canonical per language
- `hreflang` alternate links on every page
- JSON-LD Schema: `Person` + `WebSite` (global), `Article` (posts)
- `og:site_name`, `og:locale`, `twitter:card` on all pages
- Automatic `noindex` for posts with < 200 words
- `<html lang="…">` set dynamically per language via middleware

## Infrastructure

- **nginx** reverse proxy with:
  - Proxy cache (10 min TTL for HTML, 1 year for static assets)
  - Gzip compression
  - SSL/TLS via Let's Encrypt
  - www → non-www redirect (301)
  - `X-Cache-Status` header for cache debugging
- **PM2** — process manager for Next.js
- **WordPress** still running on port 8080 (legacy media files served via nginx)

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run dev server
npm run dev

# Build for production
npm run build

# Start with PM2 (on server)
pm2 start npm --name nextblog -- start
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/blogdb"
NEXT_PUBLIC_SITE_URL="https://sergovantseva.com"
```

## Deployment

```bash
# On server: pull changes, rebuild, restart
git pull
npm run build
pm2 restart nextblog
```
