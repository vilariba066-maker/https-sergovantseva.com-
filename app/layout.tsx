import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SplashScreen from '@/components/SplashScreen';

export const metadata: Metadata = {
  title: { default: 'Natalia Sergovantseva — Relationship Coach', template: '%s | Natalia Sergovantseva' },
  description: "Create the harmonious relationships you've always dreamed of.",
  metadataBase: new URL('https://sergovantseva.com'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
