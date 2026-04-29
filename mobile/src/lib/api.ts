export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
};

function buildQueryString(
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  if (!query) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const value = search.toString();
  return value ? `?${value}` : '';
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

export function resolveApiUrl(input?: string | null) {
  const fallback = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://10.0.2.2:3000';
  return normalizeBaseUrl(input || fallback);
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await fetch(
    `${resolveApiUrl(baseUrl)}${path}${buildQueryString(options.query)}`,
    {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) {
        message = parsed.message.join(', ');
      } else if (typeof parsed.message === 'string') {
        message = parsed.message;
      }
    } catch {}
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiList<T>(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions = {},
) {
  const payload = await apiRequest<T[] | { items?: T[] }>(baseUrl, path, options);
  if (Array.isArray(payload)) return payload;
  return payload.items ?? [];
}
