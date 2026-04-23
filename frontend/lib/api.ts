import { INTERNAL_API_BASE_URL } from './constants';

const TOKEN_COOKIE = 'erp_token';

function resolveBaseUrl() {
  return typeof window === 'undefined' ? INTERNAL_API_BASE_URL : '/api/proxy';
}

function getServerToken(): string | null {
  if (typeof window !== 'undefined') return null;
  try {
    // Next.js server-side: use next/headers (dynamic import to avoid client errors)
    const { cookies } = require('next/headers');
    const jar = cookies();
    return jar.get(TOKEN_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

function buildQueryString(query?: Record<string, string | number | boolean | undefined | null>) {
  if (!query) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

function unwrapListPayload<T>(payload: T[] | { items?: T[] }) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window === 'undefined' ? getServerToken() : null;
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeader,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
    credentials: typeof window === 'undefined' ? undefined : 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  fetch: <T = any>(path: string) => apiFetch<T>(path),
  list: <T = any>(
    endpoint: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ) =>
    apiFetch<T[] | { items?: T[] }>(`/${endpoint}${buildQueryString(query)}`).then(unwrapListPayload),
  listPage: <T = any>(
    endpoint: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ) => apiFetch<T>(`/${endpoint}${buildQueryString(query)}`),
  query: <T = any>(
    endpoint: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ) => apiFetch<T>(`/${endpoint}${buildQueryString(query)}`),
  get: <T = any>(endpoint: string, id: string) => apiFetch<T>(`/${endpoint}/${id}`),
  getOne: <T = any>(endpoint: string) => apiFetch<T>(`/${endpoint}`),
  create: <T = any>(endpoint: string, body: unknown) =>
    apiFetch<T>(`/${endpoint}`, { method: 'POST', body: JSON.stringify(body) }),
  update: <T = any>(endpoint: string, id: string, body: unknown) =>
    apiFetch<T>(`/${endpoint}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T = any>(endpoint: string, body: unknown) =>
    apiFetch<T>(`/${endpoint}`, { method: 'PUT', body: JSON.stringify(body) }),
  post: <T = any>(endpoint: string, body: unknown) =>
    apiFetch<T>(`/${endpoint}`, { method: 'POST', body: JSON.stringify(body) }),
  delete: <T = any>(endpoint: string) => apiFetch<T>(`/${endpoint}`, { method: 'DELETE' }),
  postDocument: <T = any>(endpoint: string, id: string) =>
    apiFetch<T>(`/${endpoint}/${id}/post`, { method: 'POST', body: JSON.stringify({}) }),
};
