const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  POSTED: 'Postuar',
  CANCELLED: 'Anuluar',
  STORNO: 'Storno',
  PARTIALLY_RETURNED: 'Kthyer Pjeserisht',
  FULLY_RETURNED: 'Kthyer Plotesisht',
  PURCHASE_IN: 'Hyrje Blerjeje',
  SALE_OUT: 'Dalje Shitjeje',
  SALES_RETURN_IN: 'Kthim Shitjeje',
  ADJUSTMENT_PLUS: 'Rregullim +',
  ADJUSTMENT_MINUS: 'Rregullim -',
  TRANSFER_OUT: 'Transfer Dalje',
  TRANSFER_IN: 'Transfer Hyrje',
  COUNT_IN: 'Inventar +',
  COUNT_OUT: 'Inventar -',
  OPENING: 'Hapje',
  MANUAL_IN: 'Hyrje Manuale',
  MANUAL_OUT: 'Dalje Manuale',
  RECEIPT: 'Arketim',
  PAYMENT: 'Pagese',
  CASH: 'Cash',
  BANK: 'Banke',
  UNPAID: 'Pa Pagese',
  PARTIALLY_PAID: 'Pjeserisht Paguar',
  PAID: 'Paguar',
  PENDING: 'Ne Pritje',
  ACCEPTED: 'Pranuar',
  REJECTED: 'Refuzuar',
  FAILED: 'Deshtoi',
  CURRENT: 'Ne Afat',
  DUE_TODAY: 'Afati Sot',
  OVERDUE: 'Ne Vonese',
  NO_DUE_DATE: 'Pa Afat',
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
  TRANSFER_OUT: 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200',
  TRANSFER_IN: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
  COUNT_IN: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  COUNT_OUT: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  OPENING: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  MANUAL_IN: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  MANUAL_OUT: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  RECEIPT: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  PAYMENT: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  CASH: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  BANK: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  UNPAID: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  PENDING: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  FAILED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  CURRENT: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  DUE_TODAY: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 shadow-sm',
  OVERDUE: 'bg-red-100 text-red-800 ring-1 ring-red-300 shadow-sm',
  NO_DUE_DATE: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

export function StatusBadge({ value }: { value: string | boolean | null | undefined }) {
  const key = String(value ?? '');
  const text = value === true ? 'Aktiv' : value === false ? 'Joaktiv' : STATUS_LABELS[key] ?? key;
  const style = STATUS_STYLES[key] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {text}
    </span>
  );
}
