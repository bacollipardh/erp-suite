export function StatsCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{value}</p>
      {subtitle ? <p className="text-xs text-slate-400 mt-1">{subtitle}</p> : null}
    </div>
  );
}
