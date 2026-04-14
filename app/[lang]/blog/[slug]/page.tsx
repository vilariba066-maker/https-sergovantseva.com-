import { prisma } from '@/lib/db';
import { LANGUAGES, LANG_CODES, isValidLang, blogPath } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LangSwitcher from '@/components/LangSwitcher';
import { postMetadata } from '@/lib/metadata';
import { buildFaqSchema } from '@/lib/faq';

interface Props { params: Promise<{ lang: string; slug: string }> }

export async function generateStaticParams() {
  const posts = await prisma.post.findMany({ select: { slug: true }, take: 50 });
  const result = [];
  for (const lang of LANG_CODES.filter(l => l !== 'en')) {
    for (const post of posts) result.push({ lang, slug: post.slug });
  }
  return result;
}

function countWords(html: string): number {
  return (html || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

export async function generateMetadata({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) return {};
  const typedLang = lang as Lang;
  const post = await prisma.post.findUnique({ where: { slug } });
  if (!post) return {};
  const t = await prisma.postTranslation.findFirst({ where: { post: { slug }, lang: typedLang } });
  const translatedContent = t?.content || post.content || '';
  const wordCount = countWords(translatedContent);
  const meta = postMetadata(
    typedLang,
    slug,
    t?.seoTitle || t?.title || post.seoTitle || post.title,
    t?.seoDescription || post.seoDescription || post.excerpt || '',
    post.featuredImage
  );
  if (wordCount < 200) meta.robots = { index: false, follow: true };
  return meta;
}

export default async function LangPostPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang) || lang === 'en') notFound();
  const typedLang = lang as Lang;

  const post = await prisma.post.findUnique({ where: { slug } });
  if (!post) notFound();

  const translation = await prisma.postTranslation.findFirst({
    where: { post: { slug }, lang: typedLang },
  });

  const title = translation?.title || post.title;
  const content = translation?.content || post.content;
  const langInfo = LANGUAGES[typedLang];
  const postUrl = 'https://sergovantseva.com/' + lang + '/blog/' + slug;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: translation?.seoTitle || title,
    description: translation?.seoDescription || translation?.excerpt || post.seoDescription || post.excerpt || '',
    image: post.featuredImage || 'https://sergovantseva.com/wp-content/themes/main/img/og-default.jpg',
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url: postUrl,
    inLanguage: lang,
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    translationOfWork: {
      '@type': 'Article',
      '@id': 'https://sergovantseva.com/blog/' + slug,
    },
  };

  const faqSchema = buildFaqSchema(content || '');

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

        <Link href={blogPath(typedLang)} className="back-link" style={{ marginBottom: '24px' }}>
          <svg style={{ marginRight: '8px' }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M10.354 1.646a.5.5 0 0 1 0 .708L4.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" fill="black"/>
          </svg>
          <span style={{ fontSize: '16px', fontWeight: 500 }}>{langInfo.name} Blog</span>
        </Link>

        <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: '700', fontSize: '32px', lineHeight: 1.25, marginBottom: '8px', color: '#000' }}>
          {title}
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
              alt={title}
              style={{ width: '100%', aspectRatio: '980/675', objectFit: 'cover', borderRadius: '12px', display: 'block' }}
            />
          </div>
        )}

        {content && (
          <div
            className="post-content"
            style={{ maxWidth: '780px', margin: '0 auto' }}
            dangerouslySetInnerHTML={{ __html: (content || '').replace(/\n/g, '') }}
          />
        )}

        <div style={{ maxWidth: '780px', margin: '40px auto 0', fontSize: '15px', color: '#000' }}>
          Read more on the topic{' '}
          <Link href={blogPath(typedLang)} style={{ color: '#000', textDecoration: 'underline' }}>Blog</Link>
        </div>

        <div style={{ maxWidth: '780px', margin: '32px auto 0' }}>
          <LangSwitcher currentLang={typedLang} slug={slug} compact />
        </div>
      </section>
    </div>
  );
}
