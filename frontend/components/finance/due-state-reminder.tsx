import { StatusBadge } from '@/components/status-badge';
import { formatDateOnly } from '@/lib/date';

function formatMoney(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveTone(dueState?: string | null, outstandingAmount?: number | string | null) {
  if (Number(outstandingAmount ?? 0) <= 0) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  switch (dueState) {
    case 'OVERDUE':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'DUE_TODAY':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'CURRENT':
      return 'border-sky-200 bg-sky-50 text-sky-800';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function resolveTitle(dueState?: string | null, outstandingAmount?: number | string | null) {
  if (Number(outstandingAmount ?? 0) <= 0) {
    return 'Dokumenti eshte i shlyer';
  }

  switch (dueState) {
    case 'OVERDUE':
      return 'Kerkon trajtim te menjehershem';
    case 'DUE_TODAY':
      return 'Afati perfundon sot';
    case 'CURRENT':
      return 'Dokumenti eshte ende ne afat';
    case 'NO_DUE_DATE':
      return 'Nuk ka afat te percaktuar';
    default:
      return 'Gjendja e afatit';
  }
}

function resolveMessage(params: {
  dueState?: string | null;
  dueDate?: string | null;
  daysPastDue?: number | null;
  outstandingAmount?: number | string | null;
}) {
  const { dueState, dueDate, daysPastDue, outstandingAmount } = params;
  const money = `${formatMoney(outstandingAmount)} EUR`;

  if (Number(outstandingAmount ?? 0) <= 0) {
    return 'Nuk ka mbetje per shlyerje.';
  }

  switch (dueState) {
    case 'OVERDUE':
      return `Ka ${money} te pambyllura dhe afati ka kaluar me ${Number(daysPastDue ?? 0)} dite.`;
    case 'DUE_TODAY':
      return `Ka ${money} te pambyllura dhe afati mbyllet sot.`;
    case 'CURRENT':
      return `Ka ${money} te pambyllura. Afati eshte ${formatDateOnly(dueDate)}.`;
    case 'NO_DUE_DATE':
      return `Ka ${money} te pambyllura, por dokumenti nuk ka date skadence.`;
    default:
      return `Mbetja aktuale eshte ${money}.`;
  }
}

export function DueStateReminder({
  dueState,
  dueDate,
  daysPastDue,
  outstandingAmount,
  compact = false,
}: {
  dueState?: string | null;
  dueDate?: string | null;
  daysPastDue?: number | null;
  outstandingAmount?: number | string | null;
  compact?: boolean;
}) {
  const tone = resolveTone(dueState, outstandingAmount);
  const title = resolveTitle(dueState, outstandingAmount);
  const message = resolveMessage({
    dueState,
    dueDate,
    daysPastDue,
    outstandingAmount,
  });

  if (compact) {
    return (
      <div className="min-w-[180px] space-y-1">
        {dueState ? <StatusBadge value={dueState} /> : null}
        <p className="text-xs text-slate-500">{message}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm">{message}</p>
        </div>
        {dueState ? <StatusBadge value={dueState} /> : null}
      </div>
    </div>
  );
}
