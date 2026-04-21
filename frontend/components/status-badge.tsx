const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  POSTED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  STORNO: 'bg-red-100 text-red-800',
  PARTIALLY_RETURNED: 'bg-orange-100 text-orange-800',
  FULLY_RETURNED: 'bg-slate-100 text-slate-700',
  true: 'bg-green-100 text-green-800',
  false: 'bg-red-100 text-red-800',
  PURCHASE_IN: 'bg-blue-100 text-blue-800',
  SALE_OUT: 'bg-purple-100 text-purple-800',
  SALES_RETURN_IN: 'bg-teal-100 text-teal-800',
  ADJUSTMENT_PLUS: 'bg-indigo-100 text-indigo-800',
  ADJUSTMENT_MINUS: 'bg-pink-100 text-pink-800',
};

export function StatusBadge({ value }: { value: string | boolean | null | undefined }) {
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
  const text = value === true ? 'Aktiv' : value === false ? 'Joaktiv' : (STATUS_LABELS[String(value ?? '')] ?? String(value ?? '-'));
  const style = STATUS_STYLES[String(value)] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {text}
    </span>
  );
}
