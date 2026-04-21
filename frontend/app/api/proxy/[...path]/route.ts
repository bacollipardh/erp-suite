import { NextRequest, NextResponse } from 'next/server';
import { INTERNAL_API_BASE_URL } from '@/lib/constants';

const TOKEN_COOKIE = 'erp_token';

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const targetPath = path.join('/');
  const search = request.nextUrl.search;
  const targetUrl = `${INTERNAL_API_BASE_URL}/${targetPath}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text();

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  });

  const buffer = await upstream.arrayBuffer();
  const response = new NextResponse(buffer, { status: upstream.status });

  const responseContentType = upstream.headers.get('content-type');
  if (responseContentType) {
    response.headers.set('Content-Type', responseContentType);
  }

  const disposition = upstream.headers.get('content-disposition');
  if (disposition) {
    response.headers.set('Content-Disposition', disposition);
  }

  return response;
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
