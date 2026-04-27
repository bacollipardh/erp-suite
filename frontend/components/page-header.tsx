'use client';

import Link from 'next/link';
import { hasPermission } from '@/lib/permissions';
import { useSession } from './session-provider';

export function PageHeader({
  title,
  description,
  createHref,
  createLabel = 'I ri',
  createPermission,
}: {
  title: string;
  description?: string;
  createHref?: string;
  createLabel?: string;
  createPermission?: string;
}) {
  const { user } = useSession();

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative px-5 py-5 md:px-6">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-blue-50/80 to-transparent" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200">
              ERP Workspace
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
            {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          {createHref && hasPermission(user?.permissions, createPermission) ? (
            <Link
              href={createHref}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {createLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
