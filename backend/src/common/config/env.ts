import { CookieOptions } from 'express';

function getRequiredEnv(name: string, options?: { minLength?: number; allowInDev?: boolean }) {
  const value = process.env[name]?.trim();
  const isDevelopment = (process.env.NODE_ENV ?? 'development') !== 'production';

  if (!value) {
    if (options?.allowInDev && isDevelopment) return '';
    throw new Error(`Missing required environment variable: ${name}`);
  }

  if (options?.minLength && value.length < options.minLength) {
    throw new Error(`Environment variable ${name} must be at least ${options.minLength} characters`);
  }

  return value;
}

export function assertAppEnv() {
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('JWT_SECRET', {
    minLength: process.env.NODE_ENV === 'production' ? 32 : 16,
  });
}

export function getCorsOrigins() {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return ['http://localhost:3001'];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function buildAuthCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
}
