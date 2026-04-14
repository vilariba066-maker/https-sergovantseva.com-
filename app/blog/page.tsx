import { prisma } from '@/lib/db';
import Link from 'next/link';
import LangSwitcher from '@/components/LangSwitcher';
import { blogMetadata } from '@/lib/metadata';

export const metadata = blogMetadata('en', 'Blog', 'Articles on relationships, psychology, and dating');

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

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page || '1'));
  const cat = sp.cat || '';
  const perPage = 20;

  const where: Record<string, unknown> = { status: 'published', featuredImage: { not: null } };
  if (cat && cat !== 'all') {
    where.categories = { some: { category: { slug: cat } } };
  }

  const [allPosts, total, categories] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * perPage,
      take: perPage + 1, // fetch one extra to detect if there's a "latest"
      select: { slug: true, title: true, excerpt: true, seoDescription: true, featuredImage: true, createdAt: true },
    }),
    prisma.post.count({ where }),
    prisma.category.findMany({ select: { name: true, slug: true } }),
  ]);

  // On page 1: first item becomes the featured hero post
  const latestPost = pageNum === 1 && allPosts.length > 0 ? allPosts[0] : null;
  const gridPosts = pageNum === 1 ? allPosts.slice(1) : allPosts;
  const totalPages = Math.ceil(total / perPage);

  const catHref = (slug: string) =>
    slug === 'all' ? '/blog' + (pageNum > 1 ? '' : '') : '/blog?cat=' + slug;

  return (
    <div style={{ paddingTop: '120px' }}>
      <section className="container" style={{ paddingBottom: '60px' }}>

        {/* Featured latest post — page 1 only */}
        {latestPost && (
          <div
            className="featured-post"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '80px', gap: '60px' }}
          >
            {latestPost.featuredImage && (
              <div
                className="featured-post-img"
                style={{ flex: '1 1 auto', minWidth: '200px', maxWidth: 'calc(100% - 640px)' }}
              >
                <img
                  src={latestPost.featuredImage}
                  alt={latestPost.title}
                  style={{ width: '100%', aspectRatio: '580/400', objectFit: 'cover', borderRadius: '12px' }}
                />
              </div>
            )}
            <a
              href={'/blog/' + latestPost.slug}
              className="featured-post-text"
              style={{
                width: latestPost.featuredImage ? '580px' : '100%',
                maxWidth: '100%',
                paddingTop: latestPost.featuredImage ? '40px' : '0',
                flexShrink: 0,
                color: 'inherit',
              }}
            >
              <b style={{ display: 'block', fontSize: '24px', fontWeight: 600, lineHeight: 1.4, color: '#000', marginBottom: '16px', fontFamily: "Georgia, 'Times New Roman', serif" }}>
                {latestPost.title}
              </b>
              {latestPost.excerpt && (
                <p style={{ fontSize: '15px', lineHeight: 1.5, color: '#000', marginBottom: '16px' }}>
                  {truncate(latestPost.excerpt, 40)}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                <span style={{ color: 'rgba(47,43,67,0.5)', fontSize: '15px', fontWeight: 500 }}>Blog</span>
                <MetaDot />
                <span style={{ color: 'rgba(47,43,67,0.5)', fontSize: '15px', fontWeight: 500 }}>
                  {new Date(latestPost.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </a>
          </div>
        )}

        {/* Category filter */}
        <div style={{ marginBottom: '32px' }}>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <li>
              <Link
                href="/blog"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 24px', height: '48px', borderRadius: '90px',
                  border: !cat || cat === 'all' ? '1.4px solid #000' : '1px solid #DCDDE1',
                  fontSize: '15px', color: '#000', whiteSpace: 'nowrap',
                }}
              >All</Link>
            </li>
            {categories.map(c => (
              <li key={c.slug}>
                <Link
                  href={catHref(c.slug)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 24px', height: '48px', borderRadius: '90px',
                    border: cat === c.slug ? '1.4px solid #000' : '1px solid #DCDDE1',
                    fontSize: '15px', color: '#000', whiteSpace: 'nowrap',
                  }}
                >{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Post grid */}
        <div className="blog-grid">
          {gridPosts.map(post => (
            <a key={post.slug} href={'/blog/' + post.slug} className="blog-card">
              {/* Thumbnail */}
              <div style={{ height: '264px', marginBottom: '24px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#F7F7F7' }}>
                {post.featuredImage ? (
                  <img
                    src={post.featuredImage}
                    alt={post.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/wp-content/themes/main/img/logo.svg" alt="" style={{ height: '48px', opacity: 0.12 }} />
                  </div>
                )}
              </div>
              {/* Meta */}
              <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 288px)' }}>
                <b style={{ display: 'block', fontSize: '18px', fontWeight: 600, lineHeight: 1.4, color: '#000', marginBottom: '16px', fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  {post.title}
                </b>
                {(post.excerpt || post.seoDescription) && (
                  <p style={{ fontSize: '14px', color: '#6b6b6b', lineHeight: 1.5, marginBottom: '12px' }}>
                    {truncateChars(post.excerpt || post.seoDescription, 120)}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
                  <span style={{ color: '#84858B', fontSize: '15px', fontWeight: 500 }}>Blog</span>
                  <MetaDot />
                  <span style={{ color: '#84858B', fontSize: '15px', fontWeight: 500 }}>
                    {new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '32px' }}>
            {pageNum > 1 && (
              <Link href={'/blog?page=' + (pageNum - 1) + (cat ? '&cat=' + cat : '')} className="btn-green">
                ← Prev
              </Link>
            )}
            <span style={{ fontSize: '15px', color: '#84858B', padding: '0 16px' }}>{pageNum} / {totalPages}</span>
            {pageNum < totalPages && (
              <Link href={'/blog?page=' + (pageNum + 1) + (cat ? '&cat=' + cat : '')} className="btn-green">
                Next →
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
