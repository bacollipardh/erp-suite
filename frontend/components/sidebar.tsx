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
      strokeWidth={1.7}
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

function isPathMatch(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function findDeepestActiveHref(pathname: string, items: Array<{ href: string }>) {
  return (
    items
      .filter((item) => isPathMatch(pathname, item.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
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

  const activeHrefBySection = useMemo(() => {
    const activeMap: Record<string, string | null> = {};
    for (const section of visibleSections) {
      activeMap[section.title] = findDeepestActiveHref(pathname, section.items);
    }
    return activeMap;
  }, [pathname, visibleSections]);

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
      if (activeHrefBySection[section.title]) {
        patch[section.title] = true;
      }
    }
    if (Object.keys(patch).length > 0) {
      setOpenSections((prev) => ({ ...prev, ...patch }));
    }
  }, [activeHrefBySection, visibleSections]);

  function toggle(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <aside className="relative flex h-full flex-col overflow-hidden bg-[#0B1220] text-slate-100 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.28),transparent_32%),radial-gradient(circle_at_90%_14%,rgba(14,165,233,0.16),transparent_32%)]" />

      <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-950/40">
            bp
          </div>
          <div>
            <span className="block text-sm font-semibold tracking-tight text-white">bp ERP Suite</span>
            <span className="block text-xs text-slate-400">Enterprise workspace</span>
          </div>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
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

      <nav className="relative flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Modules
        </div>
        <div className="space-y-1">
          {visibleSections.map((section) => {
            const isOpen = openSections[section.title] ?? false;
            const activeHref = activeHrefBySection[section.title];
            const hasActive = Boolean(activeHref);

            return (
              <div key={section.title}>
                <button
                  onClick={() => toggle(section.title)}
                  className={`w-full rounded-xl px-3 py-2.5 text-sm transition-all ${
                    hasActive
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        hasActive ? 'bg-blue-50 text-blue-700' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      <NavIcon path={section.iconPath} className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-left font-medium">{section.title}</span>
                    <ChevronIcon open={isOpen} />
                  </span>
                </button>

                {isOpen ? (
                  <div className="ml-7 mt-1 space-y-1 border-l border-white/10 pl-3">
                    {section.items.map((item) => {
                      const active = item.href === activeHref;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-blue-600 font-medium text-white shadow-sm shadow-blue-950/30'
                              : 'text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {active ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" /> : null}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="relative border-t border-white/10 p-4">
        <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
          <p className="text-sm font-semibold text-white">v1.0 | bp ERP Suite</p>
          <p className="mt-1 text-xs text-slate-400">Production workspace UI</p>
        </div>
      </div>
    </aside>
  );
}
