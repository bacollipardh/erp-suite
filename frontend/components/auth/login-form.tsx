'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clientLogin, setToken } from '@/lib/auth-client';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('admin@erp.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { accessToken } = await clientLogin(email, password);
      setToken(accessToken);
      const from = params.get('from') || '/dashboard';
      router.push(from);
      router.refresh();
    } catch (err: any) {
      try {
        const body = JSON.parse(err.message);
        const msg = body.message;
        setError(typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : 'Hyrja dështoi');
      } catch {
        setError(typeof err.message === 'string' ? err.message : 'Hyrja dështoi');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email-i</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="admin@erp.local"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Fjalëkalimi</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="••••••••"
        />
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Duke u kyçur...' : 'Kyçu'}
      </button>
    </form>
  );
}
