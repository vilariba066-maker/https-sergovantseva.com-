import { prisma } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import AnimateOnScroll from '@/components/AnimateOnScroll';

export const metadata: Metadata = {
  title: 'Natalia Sergovantseva — Relationship Coach',
  description: "Create the harmonious relationships you've always dreamed of.",
};

function truncate(text: string | null, words: number): string {
  if (!text) return '';
  const w = text.split(' ');
  return w.length <= words ? text : w.slice(0, words).join(' ') + '...';
}

function truncateChars(text: string | null, chars: number): string {
  if (!text) return '';
  return text.length <= chars ? text : text.slice(0, chars) + '...';
}

export default async function HomePage() {
  const posts = await prisma.post.findMany({
    where: { status: 'published', featuredImage: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 9,
    select: { slug: true, title: true, excerpt: true, seoDescription: true, featuredImage: true, createdAt: true },
  });

  return (
    <>
      <AnimateOnScroll />

      {/* Hero */}
      <section style={{ paddingTop: '180px', paddingBottom: '100px', background: '#fff' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '60px' }}>
            {/* Left: text — fade in + slide up on load */}
            <div className="animate-hidden" style={{ flex: '1 1 0', minWidth: 0 }}>
              <p style={{ fontSize: '15px', fontWeight: 500, color: '#000', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>
                Relationship Coach
              </p>
              <h1 style={{ fontSize: 'clamp(36px, 4vw, 58px)', fontWeight: 700, lineHeight: 1.1, color: '#000', marginBottom: '24px', fontFamily: "Georgia, 'Times New Roman', serif" }}>
                Create the <em style={{ fontStyle: 'italic' }}>harmonious</em> relationships<br />you&apos;ve always dreamed of!
              </h1>
              <p style={{ fontSize: '18px', fontWeight: 500, lineHeight: 1.5, color: '#000', marginBottom: '42px', maxWidth: '500px' }}>
                Individual coaching, group programs, and practical tools to transform your relationships.
              </p>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <a href="https://t.me/SoulMatcherCoach" target="_blank" rel="noopener noreferrer" className="btn-green" style={{ height: '52px', padding: '0 32px', fontSize: '16px' }}>
                  Enroll in Course
                </a>
                <Link href="/blog" className="outline-btn">
                  Read Blog
                </Link>
              </div>
            </div>
            {/* Right: photo */}
            <div style={{ flexShrink: 0, width: '420px', maxWidth: '45%' }}>
              <img
                src="/wp-content/uploads/2025/09/whatsapp-image-2025-08-27-at-00.03.53.jpeg"
                alt="Natalia Sergovantseva"
                style={{ width: '100%', height: '480px', objectFit: 'cover', objectPosition: 'top', borderRadius: '16px', display: 'block' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Latest articles */}
      <section className="container" style={{ marginBottom: '80px' }}>
        {/* Section header — fade in on scroll */}
        <div className="animate-hidden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, color: '#000', fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>Latest Articles</h2>
          <Link href="/blog" className="view-all-link" style={{ fontSize: '15px', fontWeight: 500, color: '#000', textDecoration: 'underline' }}>
            View all <span className="view-all-arrow">→</span>
          </Link>
        </div>

        {/* Cards — stagger 0.1s each */}
        <div className="blog-grid">
          {posts.map((post, i) => (
            <a
              key={post.slug}
              href={'/blog/' + post.slug}
              className="blog-card animate-hidden"
              data-delay={String(i * 0.1)}
            >
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
              <b style={{ display: 'block', fontSize: '22px', fontWeight: 600, lineHeight: 1.4, color: '#000', marginBottom: '12px', fontFamily: "Georgia, 'Times New Roman', serif" }}>
                {post.title}
              </b>
              {(post.excerpt || post.seoDescription) && (
                <p style={{ fontSize: '14px', color: '#6b6b6b', lineHeight: 1.5, marginBottom: '16px' }}>
                  {truncateChars(post.excerpt || post.seoDescription, 100)}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#84858B', fontSize: '13px', fontWeight: 500 }}>Blog</span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#C4C7D2', display: 'inline-block' }} />
                <time style={{ color: '#84858B', fontSize: '13px', fontWeight: 500 }}>
                  {new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </time>
              </div>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
