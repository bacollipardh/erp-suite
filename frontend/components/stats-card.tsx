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
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">{value}</p>
      {subtitle ? <p className="mt-1.5 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-lg">
      {content}
    </div>
  );
}
