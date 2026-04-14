import { prisma } from '@/lib/db';
import { LANGUAGES, LANG_CODES, isValidLang, postPath } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LangSwitcher from '@/components/LangSwitcher';

interface Props {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string }>;
}

function truncateChars(text: string | null, chars: number): string {
  if (!text) return '';
  return text.length <= chars ? text : text.slice(0, chars) + '...';
}

function truncate(text: string | null, words: number): string {
  if (!text) return '';
  const w = text.split(' ');
  return w.length <= words ? text : w.slice(0, words).join(' ') + '...';
}

function MetaDot() {
  return <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#C4C7D2', display: 'inline-block', flexShrink: 0 }} />;
}

export async function generateStaticParams() {
  return LANG_CODES.filter(l => l !== 'en').map(lang => ({ lang }));
}

export async function generateMetadata({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) return {};
  return { title: 'Blog — ' + LANGUAGES[lang as Lang].name };
}

export default async function LangBlogPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang) || lang === 'en') notFound();
  const typedLang = lang as Lang;

  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page || '1'));
  const perPage = 20;

  const where = { lang: typedLang, post: { featuredImage: { not: null } } };

  const [translations, total] = await Promise.all([
    prisma.postTranslation.findMany({
      where,
      skip: (pageNum - 1) * perPage,
      take: perPage,
      orderBy: { translatedAt: 'desc' },
      include: {
        post: { select: { slug: true, featuredImage: true, createdAt: true, excerpt: true } },
      },
    }),
    prisma.postTranslation.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);
  const langInfo = LANGUAGES[typedLang];

  // Featured (first on page 1)
  const latestT = pageNum === 1 && translations.length > 0 ? translations[0] : null;
  const gridTranslations = pageNum === 1 ? translations.slice(1) : translations;

  return (
    <div style={{ paddingTop: '120px' }}>
      <section className="container" style={{ paddingBottom: '60px' }}>

        {/* Featured */}
        {latestT && (
          <div
            className="featured-post"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '80px', gap: '60px' }}
          >
            {latestT.post.featuredImage && (
              <div
                className="featured-post-img"
                style={{ flex: '1 1 auto', minWidth: '200px', maxWidth: 'calc(100% - 640px)' }}
              >
                <img
                  src={latestT.post.featuredImage}
                  alt={latestT.title || ''}
                  style={{ width: '100%', aspectRatio: '580/400', objectFit: 'cover', borderRadius: '12px' }}
                />
              </div>
            )}
            <a
              href={'/' + lang + '/blog/' + latestT.post.slug}
              className="featured-post-text"
              style={{
                width: latestT.post.featuredImage ? '580px' : '100%',
                maxWidth: '100%',
                paddingTop: latestT.post.featuredImage ? '40px' : '0',
                flexShrink: 0,
                color: 'inherit',
              }}
            >
              <b style={{ display: 'block', fontSize: '24px', fontWeight: 600, lineHeight: 1.4, color: '#000', marginBottom: '16px' }}>
                {latestT.title || latestT.post.slug}
              </b>
              {(latestT.excerpt || latestT.post.excerpt) && (
                <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#6b6b6b', marginBottom: '16px' }}>
                  {truncateChars(latestT.excerpt || latestT.post.excerpt, 120)}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                <span style={{ color: 'rgba(47,43,67,0.5)', fontSize: '15px', fontWeight: 500 }}>Blog</span>
                <MetaDot />
                <span style={{ color: 'rgba(47,43,67,0.5)', fontSize: '15px', fontWeight: 500 }}>
                  {new Date(latestT.post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </a>
          </div>
        )}

        {/* Grid */}
        <div className="blog-grid">
          {gridTranslations.map(t => (
            <a key={t.post.slug} href={'/' + lang + '/blog/' + t.post.slug} className="blog-card">
              <div style={{ height: '264px', marginBottom: '24px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#F7F7F7' }}>
                {t.post.featuredImage ? (
                  <img
                    src={t.post.featuredImage}
                    alt={t.title || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/wp-content/themes/main/img/logo.svg" alt="" style={{ height: '48px', opacity: 0.12 }} />
                  </div>
                )}
              </div>
              <b style={{ display: 'block', fontSize: '18px', fontWeight: 600, lineHeight: 1.4, color: '#000', marginBottom: '16px' }}>
                {t.title || t.post.slug}
              </b>
              {(t.excerpt || t.post.excerpt) && (
                <p style={{ fontSize: '14px', color: '#6b6b6b', lineHeight: 1.5, marginBottom: '12px' }}>
                  {truncateChars(t.excerpt || t.post.excerpt, 120)}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
                <span style={{ color: '#84858B', fontSize: '15px', fontWeight: 500 }}>Blog</span>
                <MetaDot />
                <span style={{ color: '#84858B', fontSize: '15px', fontWeight: 500 }}>
                  {new Date(t.post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '32px' }}>
            {pageNum > 1 && (
              <Link href={'/' + lang + '/blog?page=' + (pageNum - 1)} className="btn-green">← Prev</Link>
            )}
            <span style={{ fontSize: '15px', color: '#84858B', padding: '0 16px' }}>{pageNum} / {totalPages}</span>
            {pageNum < totalPages && (
              <Link href={'/' + lang + '/blog?page=' + (pageNum + 1)} className="btn-green">Next →</Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
