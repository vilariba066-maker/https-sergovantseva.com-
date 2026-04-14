import { NextRequest, NextResponse } from 'next/server';

const LANG_CODES = new Set(['ru','de','fr','es','it','pl','pt','tr','uk','el']);
const SKIP = ['_next','favicon.ico','robots.txt','sitemap.xml','api','wp-content'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (SKIP.some(s => pathname.startsWith('/' + s))) return NextResponse.next();
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'en') {
    const rest = '/' + segments.slice(1).join('/');
    return NextResponse.redirect(new URL(rest || '/', req.url), 301);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
