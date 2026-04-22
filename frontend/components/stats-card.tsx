import Link from 'next/link';

export function StatsCard({
  title,
  value,
  subtitle,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{value}</p>
      {subtitle ? <p className="text-xs text-slate-400 mt-1">{subtitle}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {content}
    </div>
  );
}
