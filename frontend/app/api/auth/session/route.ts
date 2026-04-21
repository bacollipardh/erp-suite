import { NextRequest, NextResponse } from 'next/server';
import { INTERNAL_API_BASE_URL } from '@/lib/constants';

const TOKEN_COOKIE = 'erp_token';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const upstream = await fetch(`${INTERNAL_API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    const response = new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'text/plain',
      },
    });
    response.cookies.set(TOKEN_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  return new NextResponse(text, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
