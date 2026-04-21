'use client';

import { useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth-client';

export function Topbar() {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="h-16 border-b bg-white px-6 flex items-center justify-between">
      <div>
        <div className="text-lg font-semibold">bp ERP</div>
        <div className="text-xs text-slate-500">Blerje · Shitje · Stok · Kthime</div>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-slate-500 hover:text-slate-900 px-3 py-1 rounded-lg hover:bg-slate-100 transition-colors"
      >
        Dil
      </button>
    </div>
  );
}
