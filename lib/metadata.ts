import type { Metadata } from 'next';
import { LANG_CODES, postPath, blogPath } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

const BASE = 'https://sergovantseva.com';

function buildAlternates(paths: Partial<Record<Lang, string>>) {
  const enPath = paths['en'] || '/';
  const languages: Record<string, string> = { 'x-default': BASE + enPath };
  for (const lang of LANG_CODES) {
    const path = paths[lang as Lang] || enPath;
    languages[lang] = BASE + path;
  }
  return { canonical: BASE + enPath, languages };
}

export function blogMetadata(lang: Lang, title: string, description?: string): Metadata {
  const paths = Object.fromEntries(
    LANG_CODES.map(l => [l, blogPath(l as Lang)])
  ) as Partial<Record<Lang, string>>;
  const { canonical, languages } = buildAlternates(paths);
  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: { title, description, url: BASE + blogPath(lang) },
  };
}

export function postMetadata(
  lang: Lang,
  slug: string,
  title: string,
  description?: string,
  image?: string | null,
): Metadata {
  const paths = Object.fromEntries(
    LANG_CODES.map(l => [l, postPath(l as Lang, slug)])
  ) as Partial<Record<Lang, string>>;
  const { canonical, languages } = buildAlternates(paths);
  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      title,
      description,
      url: BASE + postPath(lang, slug),
      images: image ? [{ url: image }] : [],
      type: 'article',
    },
  };
}
