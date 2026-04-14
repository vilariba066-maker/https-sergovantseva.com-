import { prisma } from '@/lib/db';
import { LANG_CODES, postPath, blogPath } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import type { MetadataRoute } from 'next';

const BASE = 'https://sergovantseva.com';

function homePath(lang: Lang): string {
  return lang === 'en' ? '/' : '/' + lang;
}

function buildLangAlternates(pathFn: (l: Lang) => string) {
  const langs = Object.fromEntries(
    LANG_CODES.map(l => [l, BASE + pathFn(l)])
  );
  return { ...langs, 'x-default': BASE + pathFn('en') };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await prisma.post.findMany({
    where: { status: 'published' },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const entries: MetadataRoute.Sitemap = [];

  // Home page + all language home pages
  entries.push({
    url: BASE + '/',
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1.0,
    alternates: { languages: buildLangAlternates(homePath) },
  });

  // Blog listing page + all language blog pages
  entries.push({
    url: BASE + '/blog',
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
    alternates: { languages: buildLangAlternates(blogPath) },
  });

  // Individual posts with all language alternates
  for (const post of posts) {
    entries.push({
      url: BASE + '/blog/' + post.slug,
      lastModified: post.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: { languages: buildLangAlternates(l => postPath(l, post.slug)) },
    });
  }

  return entries;
}
