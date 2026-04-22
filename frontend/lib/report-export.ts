import { formatDateOnly } from './date';

type AgingExportItem = {
  id: string;
  docNo: string;
  docDate: string;
  dueDate: string;
  total: number;
  paid: number;
  daysPastDue: number;
  outstanding: number;
  dueState: string;
  party?: { id: string; name: string } | null;
};

type AgingExportReport = {
  summary: {
    current: number;
    days1To30: number;
    days31To60: number;
    days61To90: number;
    days90Plus: number;
  };
  totalOutstanding: number;
  openCount: number;
  overdueCount: number;
  items: AgingExportItem[];
};

export type AgingExportKind = 'receivables' | 'payables';
export type PaymentActivityExportKind = 'receipts' | 'supplier-payments';

type PaymentActivityExportItem = {
  id: string;
  documentId: string;
  docNo: string;
  docDate: string;
  dueDate?: string | null;
  settlementTotal: number;
  currentOutstandingAmount: number;
  amount: number;
  paidAt: string;
  referenceNo?: string | null;
  notes?: string | null;
  remainingAmount: number;
  paymentStatusAfter?: string | null;
  createdAt: string;
  user?: { id: string; fullName: string; email?: string | null } | null;
  party?: { id: string; name: string } | null;
};

type PaymentActivityExportReport = {
  summary: {
    count: number;
    visibleCount: number;
    visibleAmount: number;
    totalAmount: number;
    currentMonthAmount: number;
    currentMonthCount: number;
  };
  items: PaymentActivityExportItem[];
  total: number;
  pageCount: number;
  page: number;
  limit: number;
};

const KIND_LABELS: Record<AgingExportKind, string> = {
  receivables: 'Receivables',
  payables: 'Payables',
};

const PAYMENT_ACTIVITY_LABELS: Record<PaymentActivityExportKind, string> = {
  receipts: 'Receipts',
  'supplier-payments': 'Supplier payments',
};

const DUE_STATE_LABELS: Record<string, string> = {
  CURRENT: 'Ne afat',
  DUE_TODAY: 'Skadon sot',
  OVERDUE: 'Me vonese',
  NO_DUE_DATE: 'Pa afat',
};

function formatAmount(value: number) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDueState(value: string) {
  return DUE_STATE_LABELS[value] ?? value;
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvEscape).join(',');
}

function slugifyDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function buildAgingExportFilename(kind: AgingExportKind, date = new Date()) {
  return `${kind}-aging-${slugifyDate(date)}.csv`;
}

export function triggerCsvDownload(filename: string, csvContent: string) {
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildAgingCsv(kind: AgingExportKind, report: AgingExportReport) {
  const label = KIND_LABELS[kind];
  const rows = [
    buildCsvRow([
      `${label} Report`,
      'Doc No',
      'Party',
      'Doc Date',
      'Due Date',
      'Total',
      'Paid',
      'Outstanding',
      'Due State',
      'Days Past Due',
    ]),
    ...report.items.map((row) =>
      buildCsvRow([
        label,
        row.docNo,
        row.party?.name ?? '-',
        formatDateOnly(row.docDate),
        formatDateOnly(row.dueDate),
        formatAmount(Number(row.total ?? 0)),
        formatAmount(Number(row.paid ?? 0)),
        formatAmount(Number(row.outstanding ?? 0)),
        formatDueState(row.dueState),
        row.dueState === 'NO_DUE_DATE' ? '' : Math.max(0, Number(row.daysPastDue ?? 0)),
      ]),
    ),
  ];

  return rows.join('\n');
}

export function buildAgingMailtoHref(kind: AgingExportKind, report: AgingExportReport) {
  const label = KIND_LABELS[kind];
  const subject = `${label} aging summary - ${slugifyDate()}`;
  const topOverdue = [...report.items]
    .filter((row) => Number(row.daysPastDue ?? 0) > 0)
    .sort((left, right) => Number(right.daysPastDue ?? 0) - Number(left.daysPastDue ?? 0))
    .slice(0, 10);

  const body = [
    `${label} aging summary`,
    `Gjeneruar me: ${new Date().toLocaleString('sq-AL')}`,
    '',
    `Dokumente te hapura: ${report.openCount}`,
    `Dokumente overdue: ${report.overdueCount}`,
    `Total outstanding: ${formatAmount(report.totalOutstanding)} EUR`,
    '',
    'Buckets:',
    `- Aktuale: ${formatAmount(report.summary.current)} EUR`,
    `- 1-30 dite: ${formatAmount(report.summary.days1To30)} EUR`,
    `- 31-60 dite: ${formatAmount(report.summary.days31To60)} EUR`,
    `- 61-90 dite: ${formatAmount(report.summary.days61To90)} EUR`,
    `- 90+ dite: ${formatAmount(report.summary.days90Plus)} EUR`,
    '',
    topOverdue.length > 0 ? 'Top dokumentet me vonese:' : 'Nuk ka dokumente me vonese.',
    ...topOverdue.map(
      (row) =>
        `- ${row.docNo} | ${row.party?.name ?? '-'} | ${formatAmount(Number(row.outstanding ?? 0))} EUR | ${row.daysPastDue} dite | afati ${formatDateOnly(row.dueDate)}`,
    ),
  ].join('\n');

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildPaymentActivityExportFilename(
  kind: PaymentActivityExportKind,
  date = new Date(),
) {
  return `${kind}-${slugifyDate(date)}.csv`;
}

export function buildPaymentActivityCsv(
  kind: PaymentActivityExportKind,
  report: PaymentActivityExportReport,
) {
  const label = PAYMENT_ACTIVITY_LABELS[kind];
  const rows = [
    buildCsvRow([
      `${label} Report`,
      'Payment Date',
      'Document',
      'Party',
      'Doc Date',
      'Due Date',
      'Amount',
      'Remaining After',
      'Current Outstanding',
      'Status',
      'Operator',
      'Reference',
      'Notes',
    ]),
    ...report.items.map((row) =>
      buildCsvRow([
        label,
        formatDateOnly(row.paidAt),
        row.docNo,
        row.party?.name ?? '-',
        formatDateOnly(row.docDate),
        formatDateOnly(row.dueDate),
        formatAmount(Number(row.amount ?? 0)),
        formatAmount(Number(row.remainingAmount ?? 0)),
        formatAmount(Number(row.currentOutstandingAmount ?? 0)),
        row.paymentStatusAfter ?? '-',
        row.user?.fullName ?? row.user?.email ?? '-',
        row.referenceNo ?? '-',
        row.notes ?? '',
      ]),
    ),
  ];

  return rows.join('\n');
}

export function buildPaymentActivityMailtoHref(
  kind: PaymentActivityExportKind,
  report: PaymentActivityExportReport,
) {
  const label = PAYMENT_ACTIVITY_LABELS[kind];
  const subject = `${label} summary - ${slugifyDate()}`;
  const topItems = [...report.items]
    .sort((left, right) => Number(right.amount ?? 0) - Number(left.amount ?? 0))
    .slice(0, 10);

  const body = [
    `${label} summary`,
    `Gjeneruar me: ${new Date().toLocaleString('sq-AL')}`,
    '',
    `Gjithsej regjistrime: ${report.summary.count}`,
    `Rreshta te filtruar: ${report.total}`,
    `Shuma totale e filtruar: ${formatAmount(report.summary.totalAmount)} EUR`,
    `Shuma kete muaj: ${formatAmount(report.summary.currentMonthAmount)} EUR`,
    `Regjistrime kete muaj: ${report.summary.currentMonthCount}`,
    '',
    topItems.length > 0 ? 'Top pagesat sipas shumes:' : 'Nuk ka pagesa per filtrat e zgjedhur.',
    ...topItems.map(
      (row) =>
        `- ${formatDateOnly(row.paidAt)} | ${row.docNo} | ${row.party?.name ?? '-'} | ${formatAmount(Number(row.amount ?? 0))} EUR | mbetur ${formatAmount(Number(row.currentOutstandingAmount ?? 0))} EUR`,
    ),
  ].join('\n');

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
