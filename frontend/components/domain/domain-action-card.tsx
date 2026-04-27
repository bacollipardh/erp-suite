import Link from 'next/link';

const toneClasses = {
  slate: 'border-slate-200 bg-white hover:border-slate-300',
  indigo: 'border-blue-200 bg-white hover:border-blue-300',
  emerald: 'border-emerald-200 bg-white hover:border-emerald-300',
  amber: 'border-amber-200 bg-white hover:border-amber-300',
} as const;

const badgeClasses = {
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
  indigo: 'border-blue-200 bg-blue-50 text-blue-700',
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
      className={`group block rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 ${toneClasses[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {badge ? (
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses[tone]}`}
            >
              {badge}
            </span>
          ) : null}
          <h3 className="mt-4 text-base font-semibold text-slate-950 group-hover:text-blue-700">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <span className="rounded-xl bg-slate-50 p-2 text-slate-400 ring-1 ring-slate-200 transition-colors group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:ring-blue-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.9}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5l6 7.5-6 7.5M19.5 12h-15" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
