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
  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="text-left px-4 py-3 font-medium text-slate-600">
                {column.title}
              </th>
            ))}
            {detailsBasePath ? <th className="px-4 py-3" /> : null}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={row.id ?? String(index)} className="border-b last:border-b-0">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 align-top">
                  {column.render(row)}
                </td>
              ))}
              {detailsBasePath && row.id ? (
                <td className="px-4 py-3 text-right">
                  <Link href={`${detailsBasePath}/${row.id}`} className="text-slate-900 font-medium">
                    Hap
                  </Link>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
