const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Drafto',
  POSTED: 'Postuar',
  CANCELLED: 'Anuluar',
  STORNO: 'Storno',
  PARTIALLY_RETURNED: 'Kthyer Part.',
  FULLY_RETURNED: 'Kthyer Plot.',
  PURCHASE_IN: 'Hyrje Blerjeje',
  SALE_OUT: 'Dalje Shitjeje',
  SALES_RETURN_IN: 'Kthim Shitjeje',
  ADJUSTMENT_PLUS: 'Rregullim +',
  ADJUSTMENT_MINUS: 'Rregullim −',
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  POSTED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  STORNO: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  PARTIALLY_RETURNED: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  FULLY_RETURNED: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  true: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  false: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  PURCHASE_IN: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  SALE_OUT: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  SALES_RETURN_IN: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  ADJUSTMENT_PLUS: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  ADJUSTMENT_MINUS: 'bg-pink-50 text-pink-700 ring-1 ring-pink-200',
};

export function StatusBadge({ value }: { value: string | boolean | null | undefined }) {
  const key = String(value ?? '');
  const text = value === true ? 'Aktiv' : value === false ? 'Joaktiv' : (STATUS_LABELS[key] ?? key);
  const style = STATUS_STYLES[key] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {text}
    </span>
  );
}
