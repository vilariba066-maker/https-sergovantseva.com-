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
    select: {
      slug: true,
      title: true,
      updatedAt: true,
      translations: {
        select: {
          lang: true,
          slug: true,
          title: true,
          isReal: true,
          sitemapAt: true,
        },
      },
    },
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

  // Individual posts — only include translation URLs that are real and sitemap-ready
  for (const post of posts) {
    // Instruction 7.3: only real translations with sitemapAt set and different title
    const realLangs = post.translations
      .filter(t => t.isReal && t.sitemapAt && t.title !== post.title)
      .map(t => t.lang);

    const translationMap = Object.fromEntries(
      post.translations.map(t => [t.lang, t])
    );

    // Build alternates: en + x-default always point to original slug
    const langAlternates: Record<string, string> = {
      'en': BASE + '/blog/' + post.slug,
      'x-default': BASE + '/blog/' + post.slug,
    };

    for (const lang of realLangs) {
      const t = translationMap[lang];
      const slug = t?.slug || post.slug; // use translated slug, fallback to original
      langAlternates[lang] = BASE + postPath(lang as Lang, slug);
    }

    entries.push({
      url: BASE + '/blog/' + post.slug,
      lastModified: post.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: { languages: langAlternates },
    });
  }

  return entries;
}
