'use client';

import { useRouter } from 'next/navigation';
import { clientLogout } from '@/lib/auth-client';
import { useSession } from './session-provider';

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { user, clear } = useSession();

  async function handleLogout() {
    await clientLogout();
    clear();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
            aria-label="Hap menune"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.9}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              ERP Control Center
            </p>
            <p className="text-lg font-semibold leading-tight tracking-tight text-slate-950">
              bp ERP
            </p>
            <p className="hidden text-xs leading-tight text-slate-500 sm:block">
              Shitje | Blerje | Financa | Stok
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold leading-tight text-slate-900">
              {user?.fullName ?? 'Perdoruesi'}
            </p>
            <p className="text-xs leading-tight text-slate-500">{user?.role ?? 'SESSION'}</p>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.9}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
            <span className="hidden sm:inline">Dil</span>
          </button>
        </div>
      </div>
    </header>
  );
}
