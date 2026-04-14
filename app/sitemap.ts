import { prisma } from '@/lib/db';
import { LANG_CODES, postPath, blogPath } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import type { MetadataRoute } from 'next';

const BASE = 'https://sergovantseva.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await prisma.post.findMany({
    where: { status: 'published' },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const entries: MetadataRoute.Sitemap = [];

  for (const lang of LANG_CODES) {
    entries.push({
      url: BASE + blogPath(lang as Lang),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: lang === 'en' ? 0.9 : 0.7,
    });
  }

  for (const post of posts) {
    for (const lang of LANG_CODES) {
      entries.push({
        url: BASE + postPath(lang as Lang, post.slug),
        lastModified: post.updatedAt,
        changeFrequency: 'weekly',
        priority: lang === 'en' ? 0.8 : 0.6,
      });
    }
  }

  return entries;
}
