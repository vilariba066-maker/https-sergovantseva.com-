'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  {
    section: null,
    items: [{ href: '/admin', label: 'Dashboard', icon: '◧' }],
  },
  {
    section: 'CONTENT',
    items: [
      { href: '/admin#translations', label: 'Translations', icon: '🌐' },
      { href: '/admin#sitemap',      label: 'Sitemap',      icon: '🗺' },
      { href: '/admin#quality',      label: 'Quality Gate', icon: '✅' },
    ],
  },
  {
    section: 'TOOLS',
    items: [
      { href: '/admin#scripts',   label: 'Scripts',     icon: '▶' },
      { href: '/admin#autolinker',label: 'Auto-linker', icon: '🔗' },
      { href: '/admin#log',       label: 'Recent Log',  icon: '📋' },
    ],
  },
];

const S: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 240,
    minWidth: 240,
    background: '#fff',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid #e0e0e0',
  },
  logo: {
    fontSize: 13,
    fontWeight: 600,
    color: '#3c4043',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  domain: {
    fontSize: 12,
    color: '#80868b',
    paddingLeft: 24,
  },
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#80868b',
    letterSpacing: '0.5px',
    padding: '12px 16px 4px',
    textTransform: 'uppercase' as const,
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    fontSize: 13,
    color: '#3c4043',
    textDecoration: 'none',
    borderRadius: 0,
    cursor: 'pointer',
  },
  linkActive: {
    background: '#e8f0fe',
    color: '#1a73e8',
    fontWeight: 500,
  },
  footer: {
    borderTop: '1px solid #e0e0e0',
    padding: '12px 16px',
  },
};

export function Sidebar() {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/admin/auth', { method: 'DELETE' });
    window.location.href = '/admin/login';
  }

  return (
    <aside style={S.sidebar}>
      <div style={S.header}>
        <div style={S.logo}>
          <span style={{ fontSize: 18 }}>🔑</span>
          Admin Panel
        </div>
        <div style={S.domain}>sergovantseva.com</div>
      </div>

      <nav style={S.nav}>
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.section && (
              <div style={S.sectionLabel}>{group.section}</div>
            )}
            {group.items.map(item => {
              const isActive = item.href === '/admin'
                ? pathname === '/admin'
                : false; // anchor links don't change pathname
              return (
                <a
                  key={item.href}
                  href={item.href}
                  style={{ ...S.link, ...(isActive ? S.linkActive : {}) }}
                >
                  <span style={{ fontSize: 15, width: 18, textAlign: 'center' as const }}>
                    {item.icon}
                  </span>
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={S.footer}>
        <a
          href="https://sergovantseva.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...S.link, padding: '4px 0', fontSize: 12, color: '#80868b' }}
        >
          ↗ View site
        </a>
        <button
          onClick={logout}
          disabled={loggingOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: '#80868b', padding: '4px 0', marginTop: 4,
          }}
        >
          {loggingOut ? 'Logging out…' : '↩ Logout'}
        </button>
      </div>
    </aside>
  );
}
