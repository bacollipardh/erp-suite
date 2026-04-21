'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { navSections } from '@/lib/nav';
import { hasPermission } from '@/lib/permissions';
import { useSession } from './session-provider';

function NavIcon({ path, className = 'w-4 h-4' }: { path: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.6}
      stroke="currentColor"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useSession();

  const visibleSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => hasPermission(user?.permissions, item.permission)),
        }))
        .filter((section) => section.items.length > 0),
    [user],
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of navSections) {
      initial[section.title] = section.defaultOpen ?? false;
    }
    return initial;
  });

  useEffect(() => {
    const patch: Record<string, boolean> = {};
    for (const section of visibleSections) {
      if (section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))) {
        patch[section.title] = true;
      }
    }
    if (Object.keys(patch).length > 0) {
      setOpenSections((prev) => ({ ...prev, ...patch }));
    }
  }, [pathname, visibleSections]);

  function toggle(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <aside className="h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
            bp
          </div>
          <span className="text-base font-semibold tracking-tight">bp ERP</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors lg:hidden"
            aria-label="Mbyll menune"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleSections.map((section) => {
          const isOpen = openSections[section.title] ?? false;
          const hasActive = section.items.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
          );

          return (
            <div key={section.title}>
              <button
                onClick={() => toggle(section.title)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors
                  ${
                    hasActive
                      ? 'text-slate-100 bg-slate-800'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                  }`}
              >
                <NavIcon path={section.iconPath} className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left font-medium">{section.title}</span>
                <ChevronIcon open={isOpen} />
              </button>

              {isOpen && (
                <div className="mt-0.5 ml-3 pl-4 border-l border-slate-700/60 space-y-0.5">
                  {section.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors
                          ${
                            active
                              ? 'bg-indigo-600 text-white font-medium'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                      >
                        {active && <span className="w-1 h-1 rounded-full bg-white shrink-0" />}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-slate-700/60">
        <p className="text-xs text-slate-500">v1.0 · bp ERP Suite</p>
      </div>
    </aside>
  );
}
