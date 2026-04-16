import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { LANGUAGES, LANG_CODES, isValidLang, postPath } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { CONTENT_HUBS } from '@/lib/content-hubs';

const BASE = 'https://sergovantseva.com';
const SITE_NAME = 'Natalia Sergovantseva — Relationship Coach';
const DEFAULT_OG = BASE + '/wp-content/themes/main/img/og-default.jpg';

interface Props { params: Promise<{ lang: string; slug: string }> }

export async function generateStaticParams() {
  const hubs = Object.keys(CONTENT_HUBS);
  const langs = LANG_CODES.filter(l => l !== 'en');
  return langs.flatMap(lang => hubs.map(slug => ({ lang, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) return {};
  const hub = CONTENT_HUBS[slug];
  if (!hub) return {};

  const canonical = BASE + '/hub/' + slug;   // English is canonical
  const languages: Record<string, string> = { 'x-default': canonical, en: canonical };
  for (const l of LANG_CODES.filter(c => c !== 'en')) {
    languages[l] = BASE + '/' + l + '/hub/' + slug;
  }

  return {
    title: hub.metaTitle,
    description: hub.description,
    alternates: { canonical, languages },
    openGraph: {
      title: hub.metaTitle,
      description: hub.description,
      url: BASE + '/' + lang + '/hub/' + slug,
      siteName: SITE_NAME,
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: hub.title }],
      type: 'website',
      locale: lang,
    },
    twitter: {
      card: 'summary_large_image',
      title: hub.metaTitle,
      description: hub.description,
      images: [DEFAULT_OG],
    },
    robots: { index: true, follow: true },
  };
}

export default async function LangHubPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang) || lang === 'en') notFound();
  const typedLang = lang as Lang;
  const hub = CONTENT_HUBS[slug];
  if (!hub) notFound();

  const hubUrl = BASE + '/' + lang + '/hub/' + slug;
  const langInfo = LANGUAGES[typedLang];
  const accent = hub.color;

  // Related posts matching hub keywords
  const posts = await prisma.post.findMany({
    where: {
      status: 'published',
      OR: hub.keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' as const } })),
    },
    select: { id: true, slug: true, title: true, excerpt: true, featuredImage: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Fetch translations for the matched posts
  const translations = await prisma.postTranslation.findMany({
    where: {
      lang: typedLang,
      postId: { in: posts.map(p => p.id) },
    },
    select: { postId: true, title: true, excerpt: true, slug: true },
  });

  const transMap = new Map(translations.map(t => [t.postId, t]));

  // ─── JSON-LD ──────────────────────────────────────────────────────────────
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': hubUrl + '#breadcrumb',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' + lang },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: BASE + '/' + lang + '/hub' },
      { '@type': 'ListItem', position: 3, name: hub.title, item: hubUrl },
    ],
  };

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: hub.title,
    description: hub.description,
    url: hubUrl,
    inLanguage: lang,
    breadcrumb: { '@id': hubUrl + '#breadcrumb' },
    hasPart: posts.map(p => {
      const t = transMap.get(p.id);
      const pSlug = t?.slug || p.slug;
      return {
        '@type': 'Article',
        url: BASE + postPath(typedLang, pSlug),
        name: t?.title || p.title,
      };
    }),
  };

  const faqSchema = hub.faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: hub.faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null;

  return (
    <div style={{ paddingTop: '120px', paddingBottom: '80px' }}>

      {/* Schemas */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}

      <div className="container" style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 32, fontSize: 13, color: '#80868b' }}>
          <Link href={'/' + lang} style={{ color: '#80868b', textDecoration: 'none' }}>Home</Link>
          <span aria-hidden>›</span>
          <Link href={'/' + lang + '/hub'} style={{ color: '#80868b', textDecoration: 'none' }}>Guides</Link>
          <span aria-hidden>›</span>
          <span style={{ color: '#3c4043' }}>{hub.title}</span>
        </nav>

        {/* Header */}
        <div style={{ marginBottom: 48, borderLeft: '4px solid ' + accent, paddingLeft: 20 }}>
          <h1 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 12,
            color: '#000',
          }}>
            {hub.title}
          </h1>
          <p style={{ fontSize: 18, color: '#555', lineHeight: 1.7, margin: 0 }}>
            {hub.description}
          </p>
        </div>

        {/* Pillar content (English — serves all locales) */}
        <div
          className="post-content"
          style={{ marginBottom: 48 }}
          dangerouslySetInnerHTML={{ __html: hub.intro }}
        />

        {/* FAQ */}
        {hub.faqs.length > 0 && (
          <section style={{ marginBottom: 64 }}>
            <h2 style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 26,
              fontWeight: 700,
              marginBottom: 24,
              color: '#000',
            }}>
              Frequently Asked Questions
            </h2>
            <div style={{ borderTop: '1px solid #e0e0e0' }}>
              {hub.faqs.map((faq, i) => (
                <details key={i} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: 16,
                    fontWeight: 600,
                    padding: '16px 0',
                    color: '#1a1a1a',
                    listStyle: 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    {faq.q}
                    <span style={{ fontSize: 20, color: accent, marginLeft: 12, flexShrink: 0 }}>+</span>
                  </summary>
                  <p style={{ margin: '0 0 16px', color: '#555', lineHeight: 1.75, fontSize: 15 }}>
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Related posts — localized links where available */}
        {posts.length > 0 && (
          <section>
            <h2 style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 26,
              fontWeight: 700,
              marginBottom: 28,
              color: '#000',
            }}>
              Related Articles
              <span style={{ fontSize: 14, fontWeight: 400, color: '#80868b', marginLeft: 10 }}>
                {posts.length} posts
              </span>
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 24,
            }}>
              {posts.map(post => {
                const t = transMap.get(post.id);
                const pSlug = t?.slug || post.slug;
                const pTitle = t?.title || post.title;
                const pExcerpt = t?.excerpt || post.excerpt;
                const href = postPath(typedLang, pSlug);
                return (
                  <Link
                    key={post.slug}
                    href={href}
                    className="internal-link"
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      color: 'inherit',
                      border: '1px solid #e0e0e0',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    {post.featuredImage && (
                      <img
                        src={post.featuredImage}
                        alt={pTitle}
                        loading="lazy"
                        style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                      />
                    )}
                    <div style={{ padding: '16px' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', lineHeight: 1.4, color: '#1a1a1a' }}>
                        {pTitle}
                      </h3>
                      {pExcerpt && (
                        <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.55 }}>
                          {pExcerpt.length > 110 ? pExcerpt.slice(0, 110) + '…' : pExcerpt}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Lang label */}
        <p style={{ marginTop: 48, fontSize: 13, color: '#80868b' }}>
          Viewing in {langInfo.name} {langInfo.flag} —{' '}
          <Link href={'/hub/' + slug} style={{ color: '#1a73e8' }}>Read in English</Link>
        </p>

      </div>
    </div>
  );
}
