'use client';

import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { triggerCsvDownload } from '@/lib/report-export';

export type FinancialPeriodItem = {
  id: string;
  key: string;
  label: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  status: 'OPEN' | 'SOFT_CLOSED' | 'CLOSED';
  isCurrentMonth: boolean;
  closedAt?: string | null;
  closedReason?: string | null;
  reopenedAt?: string | null;
  reopenedReason?: string | null;
  closedBy?: { id: string; fullName: string; email?: string | null } | null;
  reopenedBy?: { id: string; fullName: string; email?: string | null } | null;
};

export type FinancialPeriodsPage = {
  year: number;
  items: FinancialPeriodItem[];
  currentPeriodId?: string | null;
  summary: {
    count: number;
    openCount: number;
    softClosedCount: number;
    closedCount: number;
  };
};

export type FinancialPeriodSummary = {
  period: FinancialPeriodItem;
  summary: {
    receivablesOutstanding: number;
    payablesOutstanding: number;
    overdueReceivablesOutstanding: number;
    overduePayablesOutstanding: number;
    unappliedOutstanding: number;
    reconciliationDifference: number;
    bankNetMovement: number;
  };
  checklist: {
    periodReadyToClose: boolean;
    blockerCount: number;
    overdueReceivablesCount: number;
    overduePayablesCount: number;
    unappliedReceiptCount: number;
    unappliedPaymentCount: number;
    reconciliationExceptionCount: number;
    draftSalesCount: number;
    draftPurchaseCount: number;
    draftReturnCount: number;
  };
  receivables: Array<{
    id: string;
    docNo: string;
    docDate: string;
    dueDate?: string | null;
    party?: { id: string; name: string } | null;
    outstandingAmount: number;
    dueState: string;
    daysPastDue: number;
  }>;
  payables: Array<{
    id: string;
    docNo: string;
    docDate: string;
    dueDate?: string | null;
    party?: { id: string; name: string } | null;
    outstandingAmount: number;
    dueState: string;
    daysPastDue: number;
  }>;
  unappliedSettlements: Array<{
    id: string;
    entryType: string;
    status: string;
    paidAt: string;
    referenceNo?: string | null;
    remainingAmount: number;
    party?: { id: string; name: string } | null;
  }>;
  reconciliationExceptions: Array<{
    id: string;
    statementDate: string;
    status: string;
    direction: string;
    amount: number;
    remainingAmount: number;
    referenceNo?: string | null;
    counterpartyName?: string | null;
    account: { id: string; code: string; name: string };
  }>;
  bankMovements: Array<{
    account: { id: string; code: string; name: string };
    inflow: number;
    outflow: number;
    net: number;
    transactionCount: number;
  }>;
};

function fmtMoney(value?: number | string | null) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvEscape).join(',');
}

function buildClosingPackCsv(report: FinancialPeriodSummary) {
  const rows = [
    csvRow(['Financial Period', report.period.label]),
    csvRow(['Status', report.period.status]),
    csvRow(['Period Start', formatDateOnly(report.period.periodStart)]),
    csvRow(['Period End', formatDateOnly(report.period.periodEnd)]),
    csvRow([]),
    csvRow(['Checklist', 'Count']),
    csvRow(['Blockers', report.checklist.blockerCount]),
    csvRow(['Overdue receivables', report.checklist.overdueReceivablesCount]),
    csvRow(['Overdue payables', report.checklist.overduePayablesCount]),
    csvRow(['Unapplied receipts', report.checklist.unappliedReceiptCount]),
    csvRow(['Unapplied payments', report.checklist.unappliedPaymentCount]),
    csvRow(['Reconciliation exceptions', report.checklist.reconciliationExceptionCount]),
    csvRow(['Draft sales', report.checklist.draftSalesCount]),
    csvRow(['Draft purchases', report.checklist.draftPurchaseCount]),
    csvRow(['Draft returns', report.checklist.draftReturnCount]),
    csvRow([]),
    csvRow(['Receivables', 'Document', 'Party', 'Due Date', 'Outstanding', 'Due State']),
    ...report.receivables.map((row) =>
      csvRow([
        'Receivable',
        row.docNo,
        row.party?.name ?? '-',
        formatDateOnly(row.dueDate),
        Number(row.outstandingAmount ?? 0).toFixed(2),
        row.dueState,
      ]),
    ),
    csvRow([]),
    csvRow(['Payables', 'Document', 'Party', 'Due Date', 'Outstanding', 'Due State']),
    ...report.payables.map((row) =>
      csvRow([
        'Payable',
        row.docNo,
        row.party?.name ?? '-',
        formatDateOnly(row.dueDate),
        Number(row.outstandingAmount ?? 0).toFixed(2),
        row.dueState,
      ]),
    ),
    csvRow([]),
    csvRow(['Unapplied balances', 'Type', 'Party', 'Paid At', 'Reference', 'Remaining']),
    ...report.unappliedSettlements.map((row) =>
      csvRow([
        'Unapplied',
        row.entryType,
        row.party?.name ?? '-',
        formatDateOnly(row.paidAt),
        row.referenceNo ?? '-',
        Number(row.remainingAmount ?? 0).toFixed(2),
      ]),
    ),
    csvRow([]),
    csvRow(['Reconciliation', 'Bank', 'Date', 'Reference', 'Remaining', 'Status']),
    ...report.reconciliationExceptions.map((row) =>
      csvRow([
        'Exception',
        `${row.account.code} - ${row.account.name}`,
        formatDateOnly(row.statementDate),
        row.referenceNo ?? row.counterpartyName ?? '-',
        Number(row.remainingAmount ?? 0).toFixed(2),
        row.status,
      ]),
    ),
    csvRow([]),
    csvRow(['Bank movements', 'Bank', 'Inflow', 'Outflow', 'Net', 'Transactions']),
    ...report.bankMovements.map((row) =>
      csvRow([
        'Movement',
        `${row.account.code} - ${row.account.name}`,
        Number(row.inflow ?? 0).toFixed(2),
        Number(row.outflow ?? 0).toFixed(2),
        Number(row.net ?? 0).toFixed(2),
        row.transactionCount,
      ]),
    ),
  ];

  return rows.join('\n');
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

export function FinancialPeriodsClient({
  initialYear,
  initialPeriods,
  initialSummary,
  canManage,
}: {
  initialYear: number;
  initialPeriods: FinancialPeriodsPage;
  initialSummary: FinancialPeriodSummary | null;
  canManage: boolean;
}) {
  const [year, setYear] = useState(initialYear);
  const [periodsPage, setPeriodsPage] = useState(initialPeriods);
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    initialSummary?.period.id ?? initialPeriods.currentPeriodId ?? initialPeriods.items[0]?.id ?? '',
  );
  const [summary, setSummary] = useState<FinancialPeriodSummary | null>(initialSummary);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = useMemo(() => {
    return Array.from({ length: 5 }, (_, index) => initialYear - 2 + index);
  }, [initialYear]);

  async function loadPeriods(nextYear: number) {
    setLoadingPeriods(true);
    setError(null);

    try {
      const response = (await api.query('financial-periods', { year: nextYear })) as FinancialPeriodsPage;
      setPeriodsPage(response);
      const nextPeriodId = response.currentPeriodId ?? response.items[0]?.id ?? '';
      setSelectedPeriodId(nextPeriodId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ngarkimi i periudhave financiare deshtoi.');
    } finally {
      setLoadingPeriods(false);
    }
  }

  async function loadSummary(periodId: string) {
    if (!periodId) {
      setSummary(null);
      return;
    }

    setLoadingSummary(true);
    setError(null);

    try {
      const response = (await api.fetch(`/financial-periods/${periodId}/summary`)) as FinancialPeriodSummary;
      setSummary(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ngarkimi i closing pack deshtoi.');
    } finally {
      setLoadingSummary(false);
    }
  }

  async function updateStatus(status: 'OPEN' | 'SOFT_CLOSED' | 'CLOSED') {
    if (!selectedPeriodId) return;

    setFeedback(null);
    setError(null);

    try {
      await api.update('financial-periods', selectedPeriodId, {
        status,
        reason: reason.trim() || undefined,
      });
      await loadPeriods(year);
      await loadSummary(selectedPeriodId);
      setFeedback(`Statusi u ndryshua ne ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ndryshimi i statusit deshtoi.');
    }
  }

  async function generateYear() {
    setFeedback(null);
    setError(null);

    try {
      await api.post('financial-periods/generate', { year });
      await loadPeriods(year);
      setFeedback(`Periudhat per vitin ${year} u gjeneruan.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gjenerimi i vitit deshtoi.');
    }
  }

  useEffect(() => {
    if (!selectedPeriodId) return;
    void loadSummary(selectedPeriodId);
  }, [selectedPeriodId]);

  const selectedPeriod =
    periodsPage.items.find((row) => row.id === selectedPeriodId) ?? summary?.period ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Periudhat Financiare</h2>
            <p className="mt-1 text-sm text-slate-600">
              Menaxho hapjen dhe mbylljen mujore, kontrollo blockers dhe gjenero closing pack
              per receivables, payables, banke dhe pajtim.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                summary &&
                triggerCsvDownload(
                  `financial-close-${summary.period.key}.csv`,
                  buildClosingPackCsv(summary),
                )
              }
              disabled={!summary}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!summary}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 disabled:opacity-50"
            >
              Print / PDF
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={year}
            onChange={(event) => {
              const nextYear = Number(event.target.value);
              setYear(nextYear);
              void loadPeriods(nextYear);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                Viti {option}
              </option>
            ))}
          </select>

          <select
            value={selectedPeriodId}
            onChange={(event) => setSelectedPeriodId(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm xl:col-span-2"
          >
            {periodsPage.items.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label} - {row.status}
              </option>
            ))}
          </select>

          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Arsye per mbyllje ose rihapje"
            rows={1}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm xl:col-span-2"
          />
        </div>

        {canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateYear}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              Gjenero Vitin
            </button>
            <button
              type="button"
              onClick={() => void updateStatus('OPEN')}
              disabled={!selectedPeriodId}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50"
            >
              Rihape
            </button>
            <button
              type="button"
              onClick={() => void updateStatus('SOFT_CLOSED')}
              disabled={!selectedPeriodId}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 disabled:opacity-50"
            >
              Soft Close
            </button>
            <button
              type="button"
              onClick={() => void updateStatus('CLOSED')}
              disabled={!selectedPeriodId}
              className="rounded-lg border border-slate-300 bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Mbylle
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          label="Periudha Aktuale"
          value={selectedPeriod?.label ?? '-'}
          sub={selectedPeriod ? `${formatDateOnly(selectedPeriod.periodStart)} - ${formatDateOnly(selectedPeriod.periodEnd)}` : undefined}
        />
        <SummaryCard
          label="Statusi"
          value={selectedPeriod ? (selectedPeriod.status === 'SOFT_CLOSED' ? 'Soft Close' : selectedPeriod.status) : '-'}
          sub={`${periodsPage.summary.openCount} open | ${periodsPage.summary.softClosedCount} soft | ${periodsPage.summary.closedCount} closed`}
        />
        <SummaryCard
          label="Blockers"
          value={summary?.checklist.blockerCount ?? 0}
          sub={summary?.checklist.periodReadyToClose ? 'Ready to close' : 'Kerkohet pastrim i checklist'}
        />
        <SummaryCard
          label="Ngarkimi"
          value={loadingPeriods || loadingSummary ? 'Duke u rifreskuar' : 'Ne rregull'}
          sub="Calendar + closing pack"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Arketime te Hapura" value={fmtMoney(summary?.summary.receivablesOutstanding)} />
        <SummaryCard label="Pagesa te Hapura" value={fmtMoney(summary?.summary.payablesOutstanding)} />
        <SummaryCard label="Arketime Overdue" value={fmtMoney(summary?.summary.overdueReceivablesOutstanding)} />
        <SummaryCard label="Pagesa Overdue" value={fmtMoney(summary?.summary.overduePayablesOutstanding)} />
        <SummaryCard label="Unapplied" value={fmtMoney(summary?.summary.unappliedOutstanding)} />
        <SummaryCard label="Neto Banke" value={fmtMoney(summary?.summary.bankNetMovement)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Kalendari i Mbylljes Mujore</h3>
            <p className="mt-1 text-xs text-slate-500">
              Zgjidh muajin aktiv dhe kontrollo historikun e mbylljes, rihapjes dhe arsyet.
            </p>
          </div>
          {selectedPeriod ? <StatusBadge value={selectedPeriod.status} /> : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {periodsPage.items.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedPeriodId(row.id)}
              className={`rounded-xl border p-3 text-left transition ${
                row.id === selectedPeriodId
                  ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                  : 'border-slate-200 bg-slate-50 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                {row.isCurrentMonth ? (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Current
                  </span>
                ) : null}
              </div>
              <div className="mt-2">
                <StatusBadge value={row.status} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatDateOnly(row.periodStart)} - {formatDateOnly(row.periodEnd)}
              </p>
              {row.closedAt ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  Closed: {formatDateOnly(row.closedAt)} {row.closedBy?.fullName ? `| ${row.closedBy.fullName}` : ''}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Checklist e Mbylljes</h3>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ['Receivables overdue', summary?.checklist.overdueReceivablesCount ?? 0],
              ['Payables overdue', summary?.checklist.overduePayablesCount ?? 0],
              ['Unapplied receipts', summary?.checklist.unappliedReceiptCount ?? 0],
              ['Unapplied payments', summary?.checklist.unappliedPaymentCount ?? 0],
              ['Reconciliation exceptions', summary?.checklist.reconciliationExceptionCount ?? 0],
              ['Draft sales', summary?.checklist.draftSalesCount ?? 0],
              ['Draft purchases', summary?.checklist.draftPurchaseCount ?? 0],
              ['Draft returns', summary?.checklist.draftReturnCount ?? 0],
            ].map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-slate-600">{label}</span>
                <span className={`font-semibold ${Number(count) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Gjurmimi i Statusit</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-lg border border-slate-100 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Statusi</p>
              <div className="mt-2"><StatusBadge value={selectedPeriod?.status} /></div>
            </div>
            <div className="rounded-lg border border-slate-100 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Mbyllja e fundit</p>
              <p className="mt-1 text-slate-700">
                {selectedPeriod?.closedAt ? `${formatDateOnly(selectedPeriod.closedAt)}${selectedPeriod.closedBy?.fullName ? ` | ${selectedPeriod.closedBy.fullName}` : ''}` : 'Ende nuk eshte mbyllur.'}
              </p>
              {selectedPeriod?.closedReason ? (
                <p className="mt-1 text-xs text-slate-500">{selectedPeriod.closedReason}</p>
              ) : null}
            </div>
            <div className="rounded-lg border border-slate-100 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Rihapja e fundit</p>
              <p className="mt-1 text-slate-700">
                {selectedPeriod?.reopenedAt ? `${formatDateOnly(selectedPeriod.reopenedAt)}${selectedPeriod.reopenedBy?.fullName ? ` | ${selectedPeriod.reopenedBy.fullName}` : ''}` : 'Nuk ka rihapje te regjistruar.'}
              </p>
              {selectedPeriod?.reopenedReason ? (
                <p className="mt-1 text-xs text-slate-500">{selectedPeriod.reopenedReason}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Receivables ne Rrezik</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Dokumenti</th>
                  <th className="px-4 py-2.5">Pala</th>
                  <th className="px-4 py-2.5">Due</th>
                  <th className="px-4 py-2.5 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(summary?.receivables ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{row.docNo}</p>
                      <p className="text-xs text-slate-500">{formatDateOnly(row.docDate)}</p>
                    </td>
                    <td className="px-4 py-2.5">{row.party?.name ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span>{formatDateOnly(row.dueDate)}</span>
                        <StatusBadge value={row.dueState} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtMoney(row.outstandingAmount)}</td>
                  </tr>
                ))}
                {(summary?.receivables ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                      Nuk ka receivables te hapura per kete periudhe.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Payables ne Rrezik</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Dokumenti</th>
                  <th className="px-4 py-2.5">Pala</th>
                  <th className="px-4 py-2.5">Due</th>
                  <th className="px-4 py-2.5 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(summary?.payables ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{row.docNo}</p>
                      <p className="text-xs text-slate-500">{formatDateOnly(row.docDate)}</p>
                    </td>
                    <td className="px-4 py-2.5">{row.party?.name ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span>{formatDateOnly(row.dueDate)}</span>
                        <StatusBadge value={row.dueState} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtMoney(row.outstandingAmount)}</td>
                  </tr>
                ))}
                {(summary?.payables ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                      Nuk ka payables te hapura per kete periudhe.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Unapplied Balances</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Party</th>
                  <th className="px-4 py-2.5 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(summary?.unappliedSettlements ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge value={row.entryType} />
                        <StatusBadge value={row.status} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{row.party?.name ?? '-'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtMoney(row.remainingAmount)}</td>
                  </tr>
                ))}
                {(summary?.unappliedSettlements ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">
                      Nuk ka balanca unapplied.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Reconciliation Exceptions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Banka</th>
                  <th className="px-4 py-2.5">Ref</th>
                  <th className="px-4 py-2.5 text-right">Mbetur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(summary?.reconciliationExceptions ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{row.account.name}</p>
                      <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-slate-700">{row.referenceNo ?? row.counterpartyName ?? '-'}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <StatusBadge value={row.status} />
                        <StatusBadge value={row.direction} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtMoney(row.remainingAmount)}</td>
                  </tr>
                ))}
                {(summary?.reconciliationExceptions ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">
                      Nuk ka exceptions ne pajtim.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Bank Movement Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Banka</th>
                  <th className="px-4 py-2.5 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(summary?.bankMovements ?? []).map((row) => (
                  <tr key={row.account.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{row.account.name}</p>
                      <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        In {fmtMoney(row.inflow)} | Out {fmtMoney(row.outflow)} | {row.transactionCount} levizje
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtMoney(row.net)}</td>
                  </tr>
                ))}
                {(summary?.bankMovements ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-400">
                      Nuk ka levizje bankare per kete periudhe.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
