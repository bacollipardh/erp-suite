import Link from 'next/link';
import { ReactNode } from 'react';

type Column<T> = {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends { id?: string }>({
  data,
  columns,
  detailsBasePath,
}: {
  data: T[];
  columns: Column<T>[];
  detailsBasePath?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {col.title}
                  </th>
                ))}
                {detailsBasePath ? <th className="w-10" /> : null}
              </tr>
            </thead>
          </table>
        </div>
        <div className="text-center py-12 text-sm text-slate-400">
          Nuk ka të dhëna.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap first:pl-4 last:pr-4"
                >
                  {col.title}
                </th>
              ))}
              {detailsBasePath ? (
                <th className="px-3 py-2.5 w-10" />
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, index) => (
              <tr
                key={row.id ?? String(index)}
                className="hover:bg-slate-50/70 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 text-slate-700 whitespace-nowrap first:pl-4 last:pr-4 align-middle"
                  >
                    {col.render(row)}
                  </td>
                ))}
                {detailsBasePath && row.id ? (
                  <td className="px-3 py-2 pr-4 text-right">
                    <Link
                      href={`${detailsBasePath}/${row.id}`}
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Hap
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
