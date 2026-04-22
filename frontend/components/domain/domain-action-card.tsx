import Link from 'next/link';

const toneClasses = {
  slate: 'border-slate-200 bg-white hover:border-slate-300',
  indigo: 'border-indigo-200 bg-indigo-50/70 hover:border-indigo-300',
  emerald: 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300',
  amber: 'border-amber-200 bg-amber-50/70 hover:border-amber-300',
} as const;

const badgeClasses = {
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
} as const;

export function DomainActionCard({
  title,
  description,
  href,
  badge,
  tone = 'slate',
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
  tone?: keyof typeof toneClasses;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${toneClasses[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {badge ? (
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${badgeClasses[tone]}`}
            >
              {badge}
            </span>
          ) : null}
          <h3 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-slate-950">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <span className="text-slate-300 transition-colors group-hover:text-slate-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5l6 7.5-6 7.5M19.5 12h-15" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
