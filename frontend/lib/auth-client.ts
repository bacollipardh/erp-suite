'use client';

export async function clientLogin(email: string, password: string): Promise<{
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    permissions: string[];
  };
}> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Login failed');
  }
  return res.json();
}

export async function clientLogout() {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Logout failed');
  }

  return res.json();
}

export async function clientSession(): Promise<{
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    permissions: string[];
  };
}> {
  const res = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Session lookup failed');
  }

  return res.json();
}
