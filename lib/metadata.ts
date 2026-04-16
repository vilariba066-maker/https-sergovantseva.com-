import type { Metadata } from 'next';
import { LANG_CODES, postPath, blogPath } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

const BASE = 'https://sergovantseva.com';
const SITE_NAME = 'Natalia Sergovantseva — Relationship Coach';
const DEFAULT_OG_IMAGE = BASE + '/wp-content/themes/main/img/og-default.jpg';
const TWITTER_HANDLE = '@SoulMatcherCoach';

function buildLangAlternates(pathFn: (l: Lang) => string) {
  const languages: Record<string, string> = { 'x-default': BASE + pathFn('en') };
  for (const lang of LANG_CODES) {
    languages[lang] = BASE + pathFn(lang);
  }
  return languages;
}

export function blogMetadata(lang: Lang, title: string, description?: string): Metadata {
  const canonical = BASE + blogPath(lang);
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildLangAlternates(blogPath),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: title }],
      type: 'website',
      locale: lang,
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_HANDLE,
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export function postMetadata(
  lang: Lang,
  slug: string,
  title: string,
  description?: string,
  image?: string | null,
  langAlternates?: Record<string, string>, // optional: pass filtered hreflang per instruction 7.3
): Metadata {
  // canonical: en = /blog/slug, others = /lang/blog/slug (via postPath)
  const canonical = BASE + postPath(lang, slug);
  const ogImage = image || DEFAULT_OG_IMAGE;
  // Use provided alternates (filtered by isReal + sitemapAt), or fall back to all langs
  const languages = langAlternates ?? buildLangAlternates(l => postPath(l, slug));
  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      type: 'article',
      locale: lang,
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_HANDLE,
      title,
      description,
      images: [ogImage],
    },
  };
}
