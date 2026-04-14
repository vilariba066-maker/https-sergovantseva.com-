import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SplashScreen from '@/components/SplashScreen';

export const metadata: Metadata = {
  title: { default: 'Natalia Sergovantseva — Relationship Coach', template: '%s | Natalia Sergovantseva' },
  description: "Create the harmonious relationships you've always dreamed of.",
  metadataBase: new URL('https://sergovantseva.com'),
  openGraph: {
    siteName: 'Natalia Sergovantseva — Relationship Coach',
    images: [{ url: 'https://sergovantseva.com/wp-content/themes/main/img/og-default.jpg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@SoulMatcherCoach' },
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': 'https://sergovantseva.com/#person',
      name: 'Natalia Sergovantseva',
      jobTitle: 'Relationship Coach',
      url: 'https://sergovantseva.com',
      image: 'https://sergovantseva.com/wp-content/uploads/2025/09/whatsapp-image-2025-08-27-at-00.03.53.jpeg',
      sameAs: ['https://t.me/SoulMatcherCoach'],
      description: 'Relationship coach helping people create harmonious, fulfilling relationships through individual coaching and group programs.',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://sergovantseva.com/#website',
      url: 'https://sergovantseva.com',
      name: 'Natalia Sergovantseva — Relationship Coach',
      publisher: { '@id': 'https://sergovantseva.com/#person' },
      inLanguage: ['en','ru','de','fr','es','it','pl','pt','tr','uk','el'],
    },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const lang = headersList.get('x-lang') || 'en';

  return (
    <html lang={lang}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body style={{ fontFamily: "'DM Sans', sans-serif", background: '#fff', color: '#000' }}>
        <SplashScreen />
        <Header />
        <div>{children}</div>
        <Footer />
      </body>
    </html>
  );
}
