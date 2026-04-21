import Link from 'next/link';

export function PageHeader({
  title,
  description,
  createHref,
  createLabel = 'I ri',
}: {
  title: string;
  description?: string;
  createHref?: string;
  createLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {description ? <p className="text-sm text-slate-500 mt-0.5">{description}</p> : null}
      </div>
      {createHref ? (
        <Link
          href={createHref}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {createLabel}
        </Link>
      ) : null}
    </div>
  );
}
