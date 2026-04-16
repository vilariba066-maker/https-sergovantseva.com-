import type { Metadata } from 'next';
import { Sidebar } from './_components/Sidebar';

export const metadata: Metadata = {
  title: 'Admin — Sergovantseva',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // Fixed overlay covers the main site Header/Footer completely
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
      background: '#f1f3f4',
      overflow: 'hidden',
    }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
