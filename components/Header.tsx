'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import LangSwitcher from './LangSwitcher';
import { isValidLang, blogPath, postPath } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

const NAV = [
  { label: 'Relationship Programs', href: '/#programms', external: false },
  { label: 'Ask a Question', href: 'https://t.me/SoulMatcherCoach', external: true },
  { label: 'Blog', href: '/blog', external: false },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Parse current lang and slug from pathname
  // /ru/blog/some-slug → lang=ru, slug=some-slug
  // /blog/some-slug    → lang=en, slug=some-slug
  // /ru/blog           → lang=ru, no slug
  // /                  → lang=en, no slug
  const segments = pathname.split('/').filter(Boolean);
  const firstSeg = segments[0];
  const currentLang: Lang = (firstSeg && isValidLang(firstSeg)) ? firstSeg as Lang : 'en';
  const blogIdx = segments.indexOf('blog');
  const currentSlug: string | undefined = blogIdx !== -1 ? segments[blogIdx + 1] : undefined;

  const blogHref = blogPath(currentLang);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  const navItems = NAV.map(n => n.href === '/blog' ? { ...n, href: blogHref } : n);

  const headerStyle: React.CSSProperties = {
    position: scrolled ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 50,
    backgroundColor: '#fff',
    borderBottom: scrolled ? '1px solid #DCDDE1' : 'none',
    transition: 'border-bottom 0.2s',
  };

  return (
    <>
      {/* Desktop Header */}
      <header className="header-desktop" style={{ ...headerStyle, height: '80px', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href={currentLang === 'en' ? '/' : blogPath(currentLang)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <img
              src="/wp-content/themes/main/img/logo.svg"
              alt="Natalia Sergovantseva"
              style={{ height: '44px', width: 'auto' }}
            />
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', paddingRight: '32px', marginRight: '32px', borderRight: '1px solid #E6E7E8', height: '52px' }}>
            <ul style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              {navItems.map(({ label, href, external }) => (
                <li key={label}>
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nav-item"
                      style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: '52px', color: '#000', borderRadius: '57px', whiteSpace: 'nowrap', transition: 'background 0.2s', fontSize: '16px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F7F7F7'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >{label}</a>
                  ) : (
                    <Link
                      href={href}
                      className="nav-item"
                      style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: '52px', color: '#000', borderRadius: '57px', whiteSpace: 'nowrap', transition: 'background 0.2s', fontSize: '16px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F7F7F7'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >{label}</Link>
                  )}
                </li>
              ))}
            </ul>
            <a href="https://t.me/SoulMatcherCoach" target="_blank" rel="noopener noreferrer" className="btn-green" style={{ marginLeft: '32px', padding: '12px 28px', fontSize: '15px', height: 'auto' }}>
              Enroll in the Course
            </a>
          </nav>

          <LangSwitcher currentLang={currentLang} slug={currentSlug} compact />
        </div>
      </header>

      {/* Mobile Header */}
      <header className="header-mobile" style={{ ...headerStyle, height: '54px' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', position: 'relative' }}>
          <button
            onClick={() => setOpen(o => !o)}
            aria-label="Menu"
            style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', flexDirection: 'column', gap: '5px' }}
          >
            <span style={{ display: 'block', width: '19px', height: '2px', background: '#000', borderRadius: '10px' }} />
            <span style={{ display: 'block', width: '19px', height: '2px', background: '#000', borderRadius: '10px' }} />
            <span style={{ display: 'block', width: '19px', height: '2px', background: '#000', borderRadius: '10px' }} />
          </button>
          <Link href={currentLang === 'en' ? '/' : blogPath(currentLang)}>
            <img src="/wp-content/themes/main/img/logo.svg" alt="Natalia" style={{ height: '40px', width: 'auto' }} />
          </Link>
        </div>

        {open && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 100, overflowY: 'auto', paddingTop: '70px' }}>
            <div className="container" style={{ position: 'relative', paddingTop: '8px' }}>
              <button
                onClick={() => setOpen(false)}
                style={{ position: 'absolute', top: '-54px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#808080', lineHeight: 1 }}
              >✕</button>
              <ul style={{ borderBottom: '1px solid #E6E7E8', marginBottom: '16px' }}>
                {navItems.map(({ label, href, external }) => (
                  <li key={label}>
                    {external ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', height: '48px', fontSize: '17px', color: '#000' }}>
                        {label}
                      </a>
                    ) : (
                      <Link href={href} onClick={() => setOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', height: '48px', fontSize: '17px', color: '#000' }}>
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <a href="https://t.me/SoulMatcherCoach" target="_blank" rel="noopener noreferrer" className="btn-green" style={{ width: '100%', maxWidth: '100%', marginBottom: '24px' }}>
                Enroll in the Course
              </a>
              <LangSwitcher currentLang={currentLang} slug={currentSlug} />
            </div>
          </div>
        )}
      </header>
    </>
  );
}
