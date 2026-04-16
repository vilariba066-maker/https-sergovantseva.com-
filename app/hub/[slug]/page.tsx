import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { LANG_CODES } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { CONTENT_HUBS } from '@/lib/content-hubs';

const BASE = 'https://sergovantseva.com';
const SITE_NAME = 'Natalia Sergovantseva — Relationship Coach';
const DEFAULT_OG = BASE + '/wp-content/themes/main/img/og-default.jpg';

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return Object.keys(CONTENT_HUBS).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const hub = CONTENT_HUBS[slug];
  if (!hub) return {};

  const canonical = BASE + '/hub/' + slug;
  const languages: Record<string, string> = { 'x-default': canonical, en: canonical };
  for (const lang of LANG_CODES.filter(l => l !== 'en')) {
    languages[lang] = BASE + '/' + lang + '/hub/' + slug;
  }

  return {
    title: hub.metaTitle,
    description: hub.description,
    alternates: { canonical, languages },
    openGraph: {
      title: hub.metaTitle,
      description: hub.description,
      url: canonical,
      siteName: SITE_NAME,
      images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: hub.title }],
      type: 'website',
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

export default async function HubPage({ params }: Props) {
  const { slug } = await params;
  const hub = CONTENT_HUBS[slug];
  if (!hub) notFound();

  const canonical = BASE + '/hub/' + slug;

  // Related posts — OR match on any hub keyword in the title
  const posts = await prisma.post.findMany({
    where: {
      status: 'published',
      OR: hub.keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' as const } })),
    },
    select: { slug: true, title: true, excerpt: true, featuredImage: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // ─── JSON-LD ──────────────────────────────────────────────────────────────
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': canonical + '#breadcrumb',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: BASE + '/hub' },
      { '@type': 'ListItem', position: 3, name: hub.title, item: canonical },
    ],
  };

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: hub.title,
    description: hub.description,
    url: canonical,
    inLanguage: 'en',
    breadcrumb: { '@id': canonical + '#breadcrumb' },
    hasPart: posts.map(p => ({
      '@type': 'Article',
      url: BASE + '/blog/' + p.slug,
      name: p.title,
    })),
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

  // ─── Styles ───────────────────────────────────────────────────────────────
  const accent = hub.color;

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
          <Link href="/" style={{ color: '#80868b', textDecoration: 'none' }}>Home</Link>
          <span aria-hidden>›</span>
          <Link href="/hub" style={{ color: '#80868b', textDecoration: 'none' }}>Guides</Link>
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

        {/* Pillar content */}
        <div
          className="post-content"
          style={{ marginBottom: 48 }}
          dangerouslySetInnerHTML={{ __html: hub.intro }}
        />

        {/* FAQ accordion */}
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

        {/* Related posts */}
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
              {posts.map(post => (
                <Link
                  key={post.slug}
                  href={'/blog/' + post.slug}
                  className="internal-link"
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    color: 'inherit',
                    border: '1px solid #e0e0e0',
                    borderRadius: 8,
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  {post.featuredImage && (
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      loading="lazy"
                      style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  <div style={{ padding: '16px' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', lineHeight: 1.4, color: '#1a1a1a' }}>
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.55 }}>
                        {post.excerpt.length > 110 ? post.excerpt.slice(0, 110) + '…' : post.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
