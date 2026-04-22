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
      className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
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
    <aside className="flex h-full flex-col overflow-hidden bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold text-white">
            bp
          </div>
          <span className="text-base font-semibold tracking-tight">bp ERP</span>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white lg:hidden"
            aria-label="Mbyll menune"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {visibleSections.map((section) => {
          const isOpen = openSections[section.title] ?? false;
          const hasActive = section.items.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
          );

          return (
            <div key={section.title}>
              <button
                onClick={() => toggle(section.title)}
                className={`w-full rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  hasActive
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <NavIcon path={section.iconPath} className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left font-medium">{section.title}</span>
                  <ChevronIcon open={isOpen} />
                </span>
              </button>

              {isOpen ? (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-700/60 pl-4">
                  {section.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                          active
                            ? 'bg-indigo-600 font-medium text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {active ? <span className="h-1 w-1 shrink-0 rounded-full bg-white" /> : null}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-700/60 px-4 py-3">
        <p className="text-xs text-slate-500">v1.0 | bp ERP Suite</p>
      </div>
    </aside>
  );
}
