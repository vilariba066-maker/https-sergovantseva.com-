import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LangSwitcher from '@/components/LangSwitcher';
import { postMetadata } from '@/lib/metadata';
import { buildFaqSchema } from '@/lib/faq';

interface Props { params: Promise<{ slug: string }> }

function countWords(html: string): number {
  return (html || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({ where: { slug } });
  if (!post) return {};
  const wordCount = countWords(post.content || '');
  const meta = postMetadata('en', slug, post.seoTitle || post.title, post.seoDescription || post.excerpt || '', post.featuredImage);
  if (wordCount < 200 || post.noindex) meta.robots = { index: false, follow: true };
  return meta;
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({ where: { slug } });
  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || '',
    image: post.featuredImage || 'https://sergovantseva.com/wp-content/themes/main/img/og-default.jpg',
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url: 'https://sergovantseva.com/blog/' + slug,
    inLanguage: 'en',
    author: {
      '@type': 'Person',
      '@id': 'https://sergovantseva.com/#person',
      name: post.author || 'Natalia Sergovantseva',
    },
    publisher: {
      '@type': 'Person',
      '@id': 'https://sergovantseva.com/#person',
      name: 'Natalia Sergovantseva',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://sergovantseva.com/blog/' + slug,
    },
  };

  const faqSchema = buildFaqSchema(post.content || '');

  return (
    <div style={{ paddingTop: '120px' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <section className="container" style={{ marginBottom: '80px' }}>

        {/* Back button */}
        <Link href="/blog" className="back-link" style={{ marginBottom: '24px' }}>
          <svg style={{ marginRight: '8px', flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M10.354 1.646a.5.5 0 0 1 0 .708L4.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" fill="currentColor"/>
          </svg>
          <span style={{ fontSize: '16px', fontWeight: 500 }}>Blog</span>
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 600, lineHeight: 1.25, marginBottom: '8px', fontFamily: "Georgia, 'Times New Roman', serif", color: '#000' }}>
          {post.title}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <span style={{ color: 'rgba(47,43,67,0.5)', fontSize: '15px', fontWeight: 500 }}>Blog</span>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#84858B', display: 'inline-block' }} />
          <span style={{ color: 'rgba(47,43,67,0.5)', fontSize: '15px', fontWeight: 500 }}>
            {new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {post.featuredImage && (
          <div style={{ width: '100%', marginBottom: '40px' }}>
            <img
              src={post.featuredImage}
              alt={post.title}
              style={{ width: '100%', aspectRatio: '980/675', objectFit: 'cover', borderRadius: '12px', display: 'block' }}
            />
          </div>
        )}

        {post.content && (
          <div
            className="post-content"
            style={{ maxWidth: '780px', margin: '0 auto' }}
            dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '') }}
          />
        )}

        <div style={{ maxWidth: '780px', margin: '40px auto 0', fontSize: '15px', color: '#000' }}>
          Read more on the topic{' '}
          <Link href="/blog" style={{ color: '#000', textDecoration: 'underline' }}>Blog</Link>
        </div>

        <div style={{ maxWidth: '780px', margin: '32px auto 0' }}>
          <LangSwitcher currentLang="en" slug={slug} compact />
        </div>
      </section>
    </div>
  );
}

export async function generateStaticParams() {
  const posts = await prisma.post.findMany({ select: { slug: true }, take: 100 });
  return posts.map(p => ({ slug: p.slug }));
}
