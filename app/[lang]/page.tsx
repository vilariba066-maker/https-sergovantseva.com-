import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { isValidLang, blogPath, LANG_CODES } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

interface Props { params: Promise<{ lang: string }> }

export async function generateStaticParams() {
  return LANG_CODES.filter(l => l !== 'en').map(lang => ({ lang }));
}

export default async function LangHomePage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang) || lang === 'en') notFound();
  redirect(blogPath(lang as Lang));
}
