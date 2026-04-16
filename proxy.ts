import { NextRequest, NextResponse } from 'next/server';

const LANG_CODES = new Set(['ru','de','fr','es','it','pl','pt','tr','uk','el']);
const SKIP = ['_next','favicon.ico','robots.txt','sitemap.xml','api','wp-content'];

// ─── Admin auth ───────────────────────────────────────────────────────────────
function adminGuard(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) return null;
  if (pathname.startsWith('/admin/login')) return null;

  const token = req.cookies.get('admin_session')?.value;
  const pass  = process.env.ADMIN_PASSWORD ?? 'admin2026';
  const valid = btoa(pass);

  if (token !== valid) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }
  return null;
}

export function proxy(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/admin')) return NextResponse.next();

  if (SKIP.some(s => pathname.startsWith('/' + s))) return NextResponse.next();
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'en') {
    const rest = '/' + segments.slice(1).join('/');
    return NextResponse.redirect(new URL(rest || '/', req.url), 301);
  }
  const lang = (segments[0] && LANG_CODES.has(segments[0])) ? segments[0] : 'en';
  const response = NextResponse.next();
  response.headers.set('x-lang', lang);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
