import Link from 'next/link';
import { LANGUAGES, LANG_CODES, blogPath, postPath } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

interface Props {
  currentLang: Lang;
  slug?: string;
  compact?: boolean;
}

export default function LangSwitcher({ currentLang, slug, compact }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: compact ? 'nowrap' : 'wrap', gap: '4px' }}>
      {LANG_CODES.map(lang => {
        const href = slug ? postPath(lang as Lang, slug) : blogPath(lang as Lang);
        const info = LANGUAGES[lang as Lang];
        const isActive = lang === currentLang;

        if (compact) {
          return (
            <Link
              key={lang}
              href={href}
              title={info.name}
              style={{
                padding: '2px 4px',
                fontSize: '12px',
                borderRadius: '4px',
                fontWeight: 500,
                backgroundColor: isActive ? '#000' : 'transparent',
                color: isActive ? '#fff' : '#000',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {lang.toUpperCase()}
            </Link>
          );
        }

        return (
          <Link
            key={lang}
            href={href}
            title={info.name}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '4px',
              border: isActive ? '1px solid #000' : '1px solid #DCDDE1',
              fontWeight: 500,
              backgroundColor: isActive ? '#000' : 'transparent',
              color: isActive ? '#fff' : '#000',
              transition: 'background 0.2s, color 0.2s, border-color 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {info.flag} {lang.toUpperCase()}
          </Link>
        );
      })}
    </div>
  );
}
