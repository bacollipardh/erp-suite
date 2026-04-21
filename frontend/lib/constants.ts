function normalizeBaseUrl(value?: string) {
  return value?.trim().replace(/\/+$/, '');
}

const renderHostport = normalizeBaseUrl(process.env.BACKEND_HOSTPORT);
const derivedRenderApiBaseUrl = renderHostport ? `http://${renderHostport}/api` : undefined;

export const INTERNAL_API_BASE_URL =
  normalizeBaseUrl(process.env.INTERNAL_API_BASE_URL) ||
  derivedRenderApiBaseUrl ||
  'http://localhost:3000/api';

export const API_BASE_URL =
  normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) || INTERNAL_API_BASE_URL;
