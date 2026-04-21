import { NextResponse } from 'next/server';
import { INTERNAL_API_BASE_URL } from '@/lib/constants';

const TOKEN_COOKIE = 'erp_token';

function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}

export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(`${INTERNAL_API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'text/plain',
      },
    });
  }

  const payload = JSON.parse(text) as {
    accessToken: string;
    user: {
      id: string;
      email: string;
      fullName: string;
      role: string;
      permissions: string[];
    };
  };

  const response = NextResponse.json({ user: payload.user });
  response.cookies.set(TOKEN_COOKIE, payload.accessToken, buildCookieOptions());
  return response;
}
