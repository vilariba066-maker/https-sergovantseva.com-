export const LANGUAGES = {
  en: { name: 'English',    flag: '🇬🇧', dir: 'ltr' },
  ru: { name: 'Русский',    flag: '🇷🇺', dir: 'ltr' },
  de: { name: 'Deutsch',    flag: '🇩🇪', dir: 'ltr' },
  fr: { name: 'Français',   flag: '🇫🇷', dir: 'ltr' },
  es: { name: 'Español',    flag: '🇪🇸', dir: 'ltr' },
  it: { name: 'Italiano',   flag: '🇮🇹', dir: 'ltr' },
  pl: { name: 'Polski',     flag: '🇵🇱', dir: 'ltr' },
  pt: { name: 'Português',  flag: '🇵🇹', dir: 'ltr' },
  tr: { name: 'Türkçe',     flag: '🇹🇷', dir: 'ltr' },
  uk: { name: 'Українська', flag: '🇺🇦', dir: 'ltr' },
  el: { name: 'Ελληνικά',  flag: '🇬🇷', dir: 'ltr' },
} as const;

export type Lang = keyof typeof LANGUAGES;
export const DEFAULT_LANG: Lang = 'en';
export const LANG_CODES = Object.keys(LANGUAGES) as Lang[];

export function isValidLang(lang: string): lang is Lang {
  return lang in LANGUAGES;
}

export function blogPath(lang: Lang): string {
  return lang === 'en' ? '/blog' : '/' + lang + '/blog';
}

export function postPath(lang: Lang, slug: string): string {
  return lang === 'en' ? '/blog/' + slug : '/' + lang + '/blog/' + slug;
}
