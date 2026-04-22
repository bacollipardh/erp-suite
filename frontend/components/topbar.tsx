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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white/95 px-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
          aria-label="Hap menune"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
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
          <p className="text-sm font-semibold leading-tight text-slate-800">bp ERP</p>
          <p className="hidden text-xs leading-tight text-slate-400 sm:block">
            Shitje | Blerje | Financa | Stok
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right md:block">
          <p className="text-sm font-medium leading-tight text-slate-700">
            {user?.fullName ?? 'Perdoruesi'}
          </p>
          <p className="text-xs leading-tight text-slate-400">{user?.role ?? 'SESSION'}</p>
        </div>
        <button
          onClick={() => void handleLogout()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
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
    </header>
  );
}
