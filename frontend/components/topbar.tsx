'use client';

import { useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth-client';

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 h-14 border-b bg-white/95 backdrop-blur-sm px-4 flex items-center justify-between shadow-sm">
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden transition-colors"
          aria-label="Hap menynë"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div>
          <p className="text-sm font-semibold text-slate-800 leading-tight">bp ERP</p>
          <p className="text-xs text-slate-400 hidden sm:block leading-tight">Blerje · Shitje · Stok · Kthime</p>
        </div>
      </div>

      {/* Right */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
        </svg>
        <span className="hidden sm:inline">Dil</span>
      </button>
    </header>
  );
}
