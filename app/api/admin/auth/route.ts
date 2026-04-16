import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST /api/admin/auth  — login
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const valid = process.env.ADMIN_PASSWORD ?? 'admin2026';

  if (password !== valid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = btoa(valid);
  const cookieStore = await cookies();
  cookieStore.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/auth  — logout
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  return NextResponse.json({ ok: true });
}
