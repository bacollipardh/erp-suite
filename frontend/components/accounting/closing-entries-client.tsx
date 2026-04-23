'use client';

import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';

type ClosingPeriodItem = {
  id: string;
  key: string;
  label: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  status: 'OPEN' | 'SOFT_CLOSED' | 'CLOSED';
};

type FinancialPeriodsPage = {
  items: ClosingPeriodItem[];
  currentPeriodId?: string | null;
};

type ClosingEntryPreview = {
  period: ClosingPeriodItem;
  summary: {
    revenue: number;
    contraRevenue: number;
    netRevenue: number;
    costOfSales: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingResult: number;
    otherIncome: number;
    otherExpense: number;
    netProfit: number;
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
  controlsSummary: {
    receivablesOutstanding: number;
    payablesOutstanding: number;
    overdueReceivablesOutstanding: number;
    overduePayablesOutstanding: number;
    unappliedOutstanding: number;
    reconciliationDifference: number;
    bankNetMovement: number;
  };
  lines: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    reportSection: string;
    reportSectionLabel: string;
    side: 'DEBIT' | 'CREDIT';
    amount: number;
  }>;
  offsetLine?: {
    accountId: string;
    accountCode: string;
    accountName: string;
    side: 'DEBIT' | 'CREDIT';
    amount: number;
  } | null;
  totals: {
    debitTotal: number;
    creditTotal: number;
    lineCount: number;
  };
  existingEntry?: {
    id: string;
    entryNo: string;
    entryDate: string;
    description: string;
    sourceNo?: string | null;
    updatedAt: string;
  } | null;
};

function fmtMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {}
    return error.message;
  }

  return 'Ndodhi nje gabim gjate gjenerimit te closing entry.';
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

export function ClosingEntriesClient({
  initialPeriods,
  initialPreview,
  canManage,
}: {
  initialPeriods: FinancialPeriodsPage;
  initialPreview: ClosingEntryPreview | null;
  canManage: boolean;
}) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    initialPreview?.period.id ?? initialPeriods.currentPeriodId ?? initialPeriods.items[0]?.id ?? '',
  );
  const [preview, setPreview] = useState<ClosingEntryPreview | null>(initialPreview);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadPreview(periodId: string) {
    if (!periodId) {
      setPreview(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = (await api.query('accounting/closing-entry-preview', {
        financialPeriodId: periodId,
      })) as ClosingEntryPreview;
      setPreview(response);
      setDescription((current) =>
        current.trim().length > 0 ? current : `Mbyllje kontabel ${response.period.label}`,
      );
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!selectedPeriodId) return;

    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const response = (await api.post('accounting/closing-entries', {
        financialPeriodId: selectedPeriodId,
        description: description.trim() || undefined,
      })) as {
        entry: { entryNo: string };
      };

      await loadPreview(selectedPeriodId);
      setFeedback(`Closing entry u gjenerua me sukses: ${response.entry.entryNo}.`);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!selectedPeriodId) return;
    void loadPreview(selectedPeriodId);
  }, [selectedPeriodId]);

  return (
    <div className="space-y-5">
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Kontrolli i mbylljes kontabel</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gjenero hyrjen e mbylljes mujore qe zeron kontot profit/loss dhe e kalon rezultatin te fitimi i mbartur.
            </p>
          </div>
          {preview?.period ? <StatusBadge value={preview.period.status} /> : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={selectedPeriodId}
            onChange={(event) => setSelectedPeriodId(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {initialPeriods.items.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label} - {period.status}
              </option>
            ))}
          </select>

          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Pershkrimi i closing entry"
          />
        </div>

        {canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectedPeriodId && void loadPreview(selectedPeriodId)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              Rifresko preview
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!preview || preview.lines.length === 0 || busy}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? 'Duke gjeneruar...' : preview?.existingEntry ? 'Perditeso closing entry' : 'Gjenero closing entry'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SummaryCard
          label="Net Profit"
          value={fmtMoney(preview?.summary.netProfit ?? 0)}
          sub={preview?.period ? `${formatDateOnly(preview.period.periodStart)} - ${formatDateOnly(preview.period.periodEnd)}` : undefined}
        />
        <SummaryCard
          label="Blockers"
          value={preview?.checklist.blockerCount ?? 0}
          sub={preview?.checklist.periodReadyToClose ? 'Ready to close' : 'Ka ceshtje operative te hapura'}
        />
        <SummaryCard
          label="Receivables open"
          value={fmtMoney(preview?.controlsSummary.receivablesOutstanding ?? 0)}
          sub={fmtMoney(preview?.controlsSummary.overdueReceivablesOutstanding ?? 0)}
        />
        <SummaryCard
          label="Payables open"
          value={fmtMoney(preview?.controlsSummary.payablesOutstanding ?? 0)}
          sub={fmtMoney(preview?.controlsSummary.overduePayablesOutstanding ?? 0)}
        />
      </div>

      {preview?.existingEntry ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">Closing entry ekzistues</p>
          <p className="mt-1 text-sm text-emerald-700">
            {preview.existingEntry.entryNo} | {formatDateOnly(preview.existingEntry.entryDate)} | perditesuar me{' '}
            {formatDateOnly(preview.existingEntry.updatedAt)}
          </p>
          <p className="mt-1 text-xs text-emerald-700">{preview.existingEntry.description}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Checklist para mbylljes</h3>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ['Receivables overdue', preview?.checklist.overdueReceivablesCount ?? 0],
              ['Payables overdue', preview?.checklist.overduePayablesCount ?? 0],
              ['Unapplied receipts', preview?.checklist.unappliedReceiptCount ?? 0],
              ['Unapplied payments', preview?.checklist.unappliedPaymentCount ?? 0],
              ['Reconciliation exceptions', preview?.checklist.reconciliationExceptionCount ?? 0],
              ['Draft sales', preview?.checklist.draftSalesCount ?? 0],
              ['Draft purchases', preview?.checklist.draftPurchaseCount ?? 0],
              ['Draft returns', preview?.checklist.draftReturnCount ?? 0],
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
          <h3 className="text-sm font-semibold text-slate-900">Rezultati i periudhes</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span>Revenue</span>
              <span className="font-semibold text-slate-900">{fmtMoney(preview?.summary.revenue ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span>Contra revenue</span>
              <span className="font-semibold text-slate-900">{fmtMoney(preview?.summary.contraRevenue ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span>Cost of sales</span>
              <span className="font-semibold text-slate-900">{fmtMoney(preview?.summary.costOfSales ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span>Operating expenses</span>
              <span className="font-semibold text-slate-900">{fmtMoney(preview?.summary.operatingExpenses ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span>Other income / expense</span>
              <span className="font-semibold text-slate-900">
                {fmtMoney((preview?.summary.otherIncome ?? 0) - (preview?.summary.otherExpense ?? 0))}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
              <span className="font-semibold text-indigo-900">Net profit</span>
              <span className="font-semibold text-indigo-900">{fmtMoney(preview?.summary.netProfit ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Preview i closing entry</h2>
          <p className="mt-1 text-sm text-slate-500">
            {loading
              ? 'Duke ngarkuar preview...'
              : 'Cdo rresht mbyll balancat e kontove profit/loss dhe offset-i shkon te fitimi i mbartur.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 px-5 py-4 xl:grid-cols-4">
          <SummaryCard label="Debit total" value={fmtMoney(preview?.totals.debitTotal ?? 0)} />
          <SummaryCard label="Credit total" value={fmtMoney(preview?.totals.creditTotal ?? 0)} />
          <SummaryCard label="Rreshta" value={preview?.totals.lineCount ?? 0} />
          <SummaryCard
            label="Statusi"
            value={preview?.checklist.periodReadyToClose ? 'Ready' : 'Warning'}
            sub={preview?.period?.label}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Konto
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Seksioni
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ana
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shuma
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(preview?.lines ?? []).map((line) => (
                <tr key={`${line.accountId}-${line.side}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {line.accountCode} - {line.accountName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{line.reportSectionLabel}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={line.side} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {fmtMoney(line.amount)}
                  </td>
                </tr>
              ))}
              {(preview?.lines ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                    Nuk ka rreshta per mbyllje ne kete periudhe.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
