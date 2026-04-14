import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /feed.xml         → English RSS feed
// GET /feed.xml?lang=ru → Russian RSS feed
// GET /feed.xml?lang=de → German RSS feed  (etc.)

const BASE      = 'https://sergovantseva.com';
const SITE_NAME = 'Natalia Sergovantseva — Relationship Coach';
const AUTHOR    = 'Natalia Sergovantseva';
const EMAIL     = 'hello@sergovantseva.com';

const LANG_NAMES: Record<string, string> = {
  en: 'English', ru: 'Русский', de: 'Deutsch', fr: 'Français',
  es: 'Español', it: 'Italiano', pl: 'Polski', pt: 'Português',
  tr: 'Türkçe', uk: 'Українська', el: 'Ελληνικά',
};

const SUPPORTED_LANGS = new Set(Object.keys(LANG_NAMES));

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function postUrl(lang: string, slug: string): string {
  return lang === 'en' ? `${BASE}/blog/${slug}` : `${BASE}/${lang}/blog/${slug}`;
}

function blogUrl(lang: string): string {
  return lang === 'en' ? `${BASE}/blog` : `${BASE}/${lang}/blog`;
}

export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang') || 'en';

  if (!SUPPORTED_LANGS.has(lang)) {
    return new NextResponse('Unsupported language', { status: 400 });
  }

  const posts = await prisma.post.findMany({
    where:   { status: 'published' },
    select:  {
      slug: true, title: true, excerpt: true, content: true,
      featuredImage: true, createdAt: true, updatedAt: true,
      translations: {
        where:  { lang },
        select: { title: true, excerpt: true, content: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take:    50,
  });

  const feedUrl  = `${BASE}/feed.xml${lang !== 'en' ? '?lang=' + lang : ''}`;
  const langName = LANG_NAMES[lang];

  const items = posts.map(post => {
    const t       = post.translations[0];
    const title   = t?.title   || post.title;
    const excerpt = t?.excerpt || post.excerpt || '';
    const content = t?.content || post.content || '';
    const url     = postUrl(lang, post.slug);
    const desc    = excerpt || stripHtml(content).slice(0, 300);
    const image   = post.featuredImage
      ? `<enclosure url="${escapeXml(post.featuredImage)}" type="image/jpeg" length="0"/>`
      : '';

    return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(desc)}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <pubDate>${new Date(post.createdAt).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(AUTHOR)}</dc:creator>
      ${image}
    </item>`;
  }).join('\n');

  // hreflang alternates for all languages
  const alternates = [...SUPPORTED_LANGS].map(l => {
    const altUrl = `${BASE}/feed.xml${l !== 'en' ? '?lang=' + l : ''}`;
    return `    <atom:link rel="alternate" hreflang="${l}" href="${escapeXml(altUrl)}"/>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
>
  <channel>
    <title>${escapeXml(SITE_NAME + (lang !== 'en' ? ' — ' + langName : ''))}</title>
    <link>${escapeXml(blogUrl(lang))}</link>
    <description>${escapeXml('Relationship coaching blog by ' + AUTHOR)}</description>
    <language>${lang}</language>
    <managingEditor>${escapeXml(EMAIL)} (${escapeXml(AUTHOR)})</managingEditor>
    <webMaster>${escapeXml(EMAIL)}</webMaster>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
    <image>
      <url>${BASE}/wp-content/themes/main/img/og-default.jpg</url>
      <title>${escapeXml(SITE_NAME)}</title>
      <link>${escapeXml(blogUrl(lang))}</link>
    </image>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
${alternates}
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type':  'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
