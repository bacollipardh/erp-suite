'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { api, apiFetch } from '@/lib/api';
import { formatDateOnly, toDateInputValue } from '@/lib/date';
import { triggerCsvDownload } from '@/lib/report-export';

export type VatFinancialPeriodsPage = {
  currentPeriodId?: string | null;
  items: Array<{
    id: string;
    key: string;
    label: string;
    year: number;
    month: number;
    periodStart: string;
    periodEnd: string;
    status: 'OPEN' | 'SOFT_CLOSED' | 'CLOSED';
  }>;
};

export type VatSettlementsPage = {
  year: number;
  items: Array<{
    id: string;
    settlementNo: string;
    status: string;
    settlementDate: string;
    dueDate?: string | null;
    netVatAmount: number;
    payableAmount: number;
    receivableAmount: number;
    paidAmount: number;
    remainingPayableAmount: number;
    filedAt?: string | null;
    isFiled: boolean;
    isOverdue: boolean;
    period: {
      id: string;
      key: string;
      label: string;
      year: number;
      month: number;
      periodStart: string;
      periodEnd: string;
      status: string;
    };
  }>;
  summary: {
    count: number;
    payableTotal: number;
    receivableTotal: number;
    paidTotal: number;
    openCount: number;
    filedCount: number;
    overdueCount: number;
  };
};

export type VatSettlementPreview = {
  period: {
    id: string;
    key: string;
    label: string;
    year: number;
    month: number;
    periodStart: string;
    periodEnd: string;
    status: string;
  };
  ledger: {
    summary: {
      outputTaxableBase: number;
      outputVat: number;
      inputTaxableBase: number;
      inputVat: number;
      netVatPayable: number;
      documentCount: number;
      manualAdjustmentCount: number;
    };
    items: Array<{
      id: string;
      side: 'INPUT' | 'OUTPUT';
      entryKind: string;
      docNo: string;
      docDate: string;
      partyName?: string | null;
      taxableBase: number;
      vatAmount: number;
      sourceNo?: string | null;
      description?: string | null;
    }>;
  };
  proposed: {
    settlementNo: string;
    settlementDate: string;
    dueDate?: string | null;
    outputTaxableBase: number;
    outputVat: number;
    inputTaxableBase: number;
    inputVat: number;
    netVatAmount: number;
    payableAmount: number;
    receivableAmount: number;
    paidAmount: number;
    remainingPayableAmount: number;
    status: string;
    lines: Array<{
      accountCode: string;
      accountName: string;
      side: 'DEBIT' | 'CREDIT';
      amount: number;
    }>;
  };
  existingSettlement?: {
    id: string;
    settlementNo: string;
    status: string;
    settlementDate: string;
    dueDate?: string | null;
    payableAmount: number;
    receivableAmount: number;
    paidAmount: number;
    remainingPayableAmount: number;
    filedAt?: string | null;
    filingReferenceNo?: string | null;
    paidAt?: string | null;
    referenceNo?: string | null;
    notes?: string | null;
    journalEntry?: { id: string; entryNo: string; entryDate: string } | null;
    payments: Array<{
      id: string;
      transactionDate: string;
      amount: number;
      referenceNo?: string | null;
      notes?: string | null;
      account: { id: string; code: string; name: string; accountType: string };
    }>;
  } | null;
};

type FinanceAccountOption = {
  id: string;
  code: string;
  name: string;
  accountType: 'CASH' | 'BANK';
  currentBalance: number;
};

function fmtMoney(value?: number | string | null) {
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
      if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    } catch {}
    return error.message;
  }

  return 'Ndodhi nje gabim gjate ruajtjes se TVSH-se.';
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvEscape).join(',');
}

function buildVatReportCsv(preview: VatSettlementPreview) {
  const rows = [
    csvRow(['Periudha', preview.period.label]),
    csvRow(['Settlement No', preview.proposed.settlementNo]),
    csvRow(['Status', preview.existingSettlement?.status ?? preview.proposed.status]),
    csvRow(['Settlement Date', formatDateOnly(preview.proposed.settlementDate)]),
    csvRow(['Due Date', formatDateOnly(preview.existingSettlement?.dueDate ?? preview.proposed.dueDate)]),
    csvRow([]),
    csvRow(['Output Base', preview.proposed.outputTaxableBase]),
    csvRow(['Output VAT', preview.proposed.outputVat]),
    csvRow(['Input Base', preview.proposed.inputTaxableBase]),
    csvRow(['Input VAT', preview.proposed.inputVat]),
    csvRow(['Payable', preview.proposed.payableAmount]),
    csvRow(['Receivable', preview.proposed.receivableAmount]),
    csvRow(['Paid', preview.existingSettlement?.paidAmount ?? preview.proposed.paidAmount]),
    csvRow([]),
    csvRow(['Date', 'Document', 'Party', 'Side', 'Base', 'VAT', 'Source', 'Description']),
    ...preview.ledger.items.map((item) =>
      csvRow([
        formatDateOnly(item.docDate),
        item.docNo,
        item.partyName ?? '-',
        item.side,
        Number(item.taxableBase ?? 0).toFixed(2),
        Number(item.vatAmount ?? 0).toFixed(2),
        item.sourceNo ?? '-',
        item.description ?? '-',
      ]),
    ),
  ];

  return rows.join('\n');
}

function MetricCard({
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

export function VatSettlementsClient({
  initialYear,
  initialPeriods,
  initialSettlements,
  initialPreview,
  financeAccounts,
  canManage,
}: {
  initialYear: number;
  initialPeriods: VatFinancialPeriodsPage;
  initialSettlements: VatSettlementsPage;
  initialPreview: VatSettlementPreview | null;
  financeAccounts: FinanceAccountOption[];
  canManage: boolean;
}) {
  const [year, setYear] = useState(initialYear);
  const [periodsPage, setPeriodsPage] = useState(initialPeriods);
  const [settlementsPage, setSettlementsPage] = useState(initialSettlements);
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    initialPreview?.period.id ?? initialPeriods.currentPeriodId ?? initialPeriods.items[0]?.id ?? '',
  );
  const [preview, setPreview] = useState<VatSettlementPreview | null>(initialPreview);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [settlementDate, setSettlementDate] = useState(
    toDateInputValue(initialPreview?.proposed.settlementDate ?? new Date()),
  );
  const [dueDate, setDueDate] = useState(
    initialPreview?.existingSettlement?.dueDate
      ? toDateInputValue(initialPreview.existingSettlement.dueDate)
      : initialPreview?.proposed.dueDate
        ? toDateInputValue(initialPreview.proposed.dueDate)
        : '',
  );
  const [referenceNo, setReferenceNo] = useState(
    initialPreview?.existingSettlement?.referenceNo ?? '',
  );
  const [notes, setNotes] = useState(initialPreview?.existingSettlement?.notes ?? '');
  const [filingDate, setFilingDate] = useState(
    initialPreview?.existingSettlement?.filedAt
      ? toDateInputValue(initialPreview.existingSettlement.filedAt)
      : toDateInputValue(new Date()),
  );
  const [filingReferenceNo, setFilingReferenceNo] = useState(
    initialPreview?.existingSettlement?.filingReferenceNo ?? '',
  );
  const [paymentDate, setPaymentDate] = useState(toDateInputValue(new Date()));
  const [paymentAmount, setPaymentAmount] = useState(
    String(initialPreview?.existingSettlement?.remainingPayableAmount ?? 0),
  );
  const [paymentReferenceNo, setPaymentReferenceNo] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState(financeAccounts[0]?.id ?? '');

  useEffect(() => {
    if (!preview) return;
    setSettlementDate(toDateInputValue(preview.proposed.settlementDate));
    setDueDate(
      preview.existingSettlement?.dueDate
        ? toDateInputValue(preview.existingSettlement.dueDate)
        : preview.proposed.dueDate
          ? toDateInputValue(preview.proposed.dueDate)
          : '',
    );
    setReferenceNo(preview.existingSettlement?.referenceNo ?? '');
    setNotes(preview.existingSettlement?.notes ?? '');
    setFilingDate(
      preview.existingSettlement?.filedAt
        ? toDateInputValue(preview.existingSettlement.filedAt)
        : toDateInputValue(new Date()),
    );
    setFilingReferenceNo(preview.existingSettlement?.filingReferenceNo ?? '');
    setPaymentAmount(String(preview.existingSettlement?.remainingPayableAmount ?? 0));
  }, [preview]);

  async function loadPreview(periodId: string) {
    if (!periodId) {
      setPreview(null);
      return;
    }

    const response = await api.fetch<VatSettlementPreview>(
      `/vat-settlements/preview?financialPeriodId=${periodId}`,
    );
    setPreview(response);
  }

  async function refreshContext(nextYear = year, nextPeriodId = selectedPeriodId) {
    const [settlementsResponse, previewResponse] = await Promise.all([
      api.query<VatSettlementsPage>('vat-settlements', { year: nextYear }),
      nextPeriodId
        ? api.fetch<VatSettlementPreview>(
            `/vat-settlements/preview?financialPeriodId=${nextPeriodId}`,
          )
        : Promise.resolve(null),
    ]);

    setSettlementsPage(settlementsResponse);
    setPreview(previewResponse);
  }

  async function loadYear(nextYear: number) {
    setBusy('year');
    setError(null);
    setFeedback(null);

    try {
      const [periodsResponse, settlementsResponse] = await Promise.all([
        api.query<VatFinancialPeriodsPage>('financial-periods', { year: nextYear }),
        api.query<VatSettlementsPage>('vat-settlements', { year: nextYear }),
      ]);

      const nextPeriodId =
        periodsResponse.currentPeriodId ?? periodsResponse.items[0]?.id ?? '';

      setYear(nextYear);
      setPeriodsPage(periodsResponse);
      setSettlementsPage(settlementsResponse);
      setSelectedPeriodId(nextPeriodId);

      if (nextPeriodId) {
        await loadPreview(nextPeriodId);
      } else {
        setPreview(null);
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handlePeriodChange(periodId: string) {
    setSelectedPeriodId(periodId);
    setBusy('preview');
    setError(null);
    setFeedback(null);

    try {
      await loadPreview(periodId);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateOrUpdate() {
    if (!selectedPeriodId) return;

    setBusy('settlement');
    setError(null);
    setFeedback(null);

    try {
      await api.post('vat-settlements', {
        financialPeriodId: selectedPeriodId,
        settlementDate,
        dueDate: dueDate || undefined,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      await refreshContext(year, selectedPeriodId);
      setFeedback('Settlement-i i TVSH-se u ruajt me sukses.');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleFile() {
    if (!preview?.existingSettlement?.id) return;

    setBusy('file');
    setError(null);
    setFeedback(null);

    try {
      await apiFetch(`/vat-settlements/${preview.existingSettlement.id}/file`, {
        method: 'PATCH',
        body: JSON.stringify({
          filedAt: filingDate,
          filingReferenceNo: filingReferenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      await refreshContext(year, selectedPeriodId);
      setFeedback('Settlement-i u shenua si filed.');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handlePayment() {
    if (!preview?.existingSettlement?.id) return;

    setBusy('payment');
    setError(null);
    setFeedback(null);

    try {
      await api.post(`vat-settlements/${preview.existingSettlement.id}/payments`, {
        financeAccountId: paymentAccountId,
        amount: Number(paymentAmount || 0),
        transactionDate: paymentDate,
        referenceNo: paymentReferenceNo.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });

      await refreshContext(year, selectedPeriodId);
      setPaymentReferenceNo('');
      setPaymentNotes('');
      setFeedback('Pagesa e TVSH-se u regjistrua me sukses.');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  const selectedPeriod =
    periodsPage.items.find((row) => row.id === selectedPeriodId) ?? preview?.period ?? null;

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

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <MetricCard
          label="Settlemente"
          value={settlementsPage.summary.count}
          sub={`${settlementsPage.summary.filedCount} filed`}
        />
        <MetricCard
          label="TVSH Payable"
          value={fmtMoney(settlementsPage.summary.payableTotal)}
          sub={`${settlementsPage.summary.openCount} aktive`}
        />
        <MetricCard
          label="TVSH Receivable"
          value={fmtMoney(settlementsPage.summary.receivableTotal)}
          sub="Kerkesa / kompensim"
        />
        <MetricCard
          label="TVSH e Paguar"
          value={fmtMoney(settlementsPage.summary.paidTotal)}
          sub={`${settlementsPage.summary.overdueCount} overdue`}
        />
        <MetricCard
          label="Output VAT"
          value={fmtMoney(preview?.proposed.outputVat)}
          sub={fmtMoney(preview?.proposed.outputTaxableBase)}
        />
        <MetricCard
          label="Input VAT"
          value={fmtMoney(preview?.proposed.inputVat)}
          sub={fmtMoney(preview?.proposed.inputTaxableBase)}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Workflow mujor i TVSH-se</h2>
            <p className="mt-1 text-sm text-slate-500">
              Preview nga VAT ledger, settlement kontabel, filing reference dhe pagesa reale nga banka ose arka.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                preview &&
                triggerCsvDownload(`vat-report-${preview.period.key}.csv`, buildVatReportCsv(preview))
              }
              disabled={!preview}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Export CSV
            </button>
            <Link
              href="/raportet/kontabiliteti"
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"
            >
              Hap raportet kontabel
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={year}
            onChange={(event) => void loadYear(Number(event.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {Array.from({ length: 5 }, (_, index) => initialYear - 2 + index).map((option) => (
              <option key={option} value={option}>
                Viti {option}
              </option>
            ))}
          </select>
          <select
            value={selectedPeriodId}
            onChange={(event) => void handlePeriodChange(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm xl:col-span-2"
          >
            {periodsPage.items.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label} - {period.status}
              </option>
            ))}
          </select>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {busy ? 'Duke u rifreskuar...' : `Statusi i periudhes: ${selectedPeriod?.status ?? '-'}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Preview i periudhes</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {preview ? preview.period.label : 'Zgjidh nje periudhe financiare'}
                </p>
              </div>
              {preview ? <StatusBadge value={preview.existingSettlement?.status ?? preview.proposed.status} /> : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard label="Net VAT" value={fmtMoney(preview?.proposed.netVatAmount)} />
              <MetricCard label="Payable" value={fmtMoney(preview?.proposed.payableAmount)} />
              <MetricCard label="Receivable" value={fmtMoney(preview?.proposed.receivableAmount)} />
              <MetricCard
                label="Dokumente"
                value={preview?.ledger.summary.documentCount ?? 0}
                sub={`${preview?.ledger.summary.manualAdjustmentCount ?? 0} manual`}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Settlement date
                </span>
                <input
                  type="date"
                  value={settlementDate}
                  onChange={(event) => setSettlementDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  disabled={!canManage}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Due date
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  disabled={!canManage}
                />
              </label>
              <label className="space-y-1.5 xl:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Reference
                </span>
                <input
                  value={referenceNo}
                  onChange={(event) => setReferenceNo(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Opsionale"
                  disabled={!canManage}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2 xl:col-span-4">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Shenime per settlement ose filing"
                  disabled={!canManage}
                />
              </label>
            </div>

            {canManage ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreateOrUpdate()}
                  disabled={!selectedPeriodId || busy !== null}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {preview?.existingSettlement ? 'Perditeso settlement' : 'Gjenero settlement'}
                </button>
                <button
                  type="button"
                  onClick={() => preview && triggerCsvDownload(`vat-report-${preview.period.key}.csv`, buildVatReportCsv(preview))}
                  disabled={!preview}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Raporti mujor CSV
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Posting i settlement-it</h3>
            <p className="mt-1 text-sm text-slate-500">
              Kjo hyrje mbyll VAT input/output dhe e kalon diferencen neto ne konto reale te takses.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Konto</th>
                    <th className="px-2 py-2">Ana</th>
                    <th className="px-2 py-2 text-right">Shuma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(preview?.proposed.lines ?? []).map((line) => (
                    <tr key={`${line.accountCode}-${line.side}`}>
                      <td className="px-2 py-2 text-slate-700">
                        {line.accountCode} - {line.accountName}
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge value={line.side} />
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-slate-900">
                        {fmtMoney(line.amount)}
                      </td>
                    </tr>
                  ))}
                  {(preview?.proposed.lines ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-8 text-center text-sm text-slate-400">
                        Kjo periudhe nuk ka net VAT per settlement kontabel.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Raporti mujor i taksave</h3>
              <p className="mt-1 text-sm text-slate-500">
                VAT ledger i periudhes me dokumentet qe hyjne ne deklarim.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Dokumenti
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pala
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ana
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Base
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      VAT
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(preview?.ledger.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-600">{formatDateOnly(item.docDate)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.docNo}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.entryKind}
                          {item.sourceNo ? ` | ${item.sourceNo}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.partyName ?? '-'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={item.side} />
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(item.taxableBase)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtMoney(item.vatAmount)}</td>
                    </tr>
                  ))}
                  {(preview?.ledger.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                        Nuk ka VAT ledger rows per kete periudhe.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Filing & pagesa</h3>
            <p className="mt-1 text-sm text-slate-500">
              Settlement-i i krijuar mund te shenohet si filed dhe me pas te paguhet nga finance accounts.
            </p>

            <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Settlement</span>
                <span className="font-semibold text-slate-900">
                  {preview?.existingSettlement?.settlementNo ?? preview?.proposed.settlementNo ?? '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Statusi</span>
                {preview?.existingSettlement ? (
                  <StatusBadge value={preview.existingSettlement.status} />
                ) : preview ? (
                  <StatusBadge value={preview.proposed.status} />
                ) : null}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Filed</span>
                <span className="font-medium text-slate-900">
                  {preview?.existingSettlement?.filedAt
                    ? formatDateOnly(preview.existingSettlement.filedAt)
                    : 'Jo ende'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Per pagese</span>
                <span className="font-semibold text-slate-900">
                  {fmtMoney(preview?.existingSettlement?.remainingPayableAmount ?? preview?.proposed.payableAmount)}
                </span>
              </div>
              {preview?.existingSettlement?.journalEntry ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  Journal: {preview.existingSettlement.journalEntry.entryNo} |{' '}
                  {formatDateOnly(preview.existingSettlement.journalEntry.entryDate)}
                </div>
              ) : null}
            </div>

            {canManage && preview?.existingSettlement ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Sheno si filed</h4>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <input
                      type="date"
                      value={filingDate}
                      onChange={(event) => setFilingDate(event.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={filingReferenceNo}
                      onChange={(event) => setFilingReferenceNo(event.target.value)}
                      placeholder="Filing reference / deklarata"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleFile()}
                      disabled={busy !== null}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                    >
                      Ruaj filing
                    </button>
                  </div>
                </div>

                {(preview.existingSettlement.remainingPayableAmount ?? 0) > 0 ? (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Regjistro pagese TVSH</h4>
                    {financeAccounts.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Nuk ka llogari financiare aktive per te kryer pagesen.
                      </p>
                    ) : (
                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <select
                          value={paymentAccountId}
                          onChange={(event) => setPaymentAccountId(event.target.value)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        >
                          {financeAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.name} | {fmtMoney(account.currentBalance)}
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="date"
                            value={paymentDate}
                            onChange={(event) => setPaymentDate(event.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(event) => setPaymentAmount(event.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <input
                          value={paymentReferenceNo}
                          onChange={(event) => setPaymentReferenceNo(event.target.value)}
                          placeholder="Reference e pageses"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <textarea
                          value={paymentNotes}
                          onChange={(event) => setPaymentNotes(event.target.value)}
                          rows={2}
                          placeholder="Shenime per pagesen"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void handlePayment()}
                          disabled={busy !== null || !paymentAccountId}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                        >
                          Regjistro pagesen
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Settlementet e vitit</h3>
              <p className="mt-1 text-sm text-slate-500">
                Historiku mujor i TVSH-se me filing dhe statusin e pagesave.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Periudha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Settlement
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payable
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settlementsPage.items.map((item) => (
                    <tr
                      key={item.id}
                      className={`cursor-pointer ${item.period.id === selectedPeriodId ? 'bg-indigo-50' : ''}`}
                      onClick={() => void handlePeriodChange(item.period.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.period.label}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <StatusBadge value={item.status} />
                          {item.isFiled ? <StatusBadge value="FILED" /> : null}
                          {item.isOverdue ? <StatusBadge value="OVERDUE" /> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{item.settlementNo}</div>
                        <div className="text-xs text-slate-400">
                          {formatDateOnly(item.settlementDate)}
                          {item.dueDate ? ` | due ${formatDateOnly(item.dueDate)}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-slate-900">{fmtMoney(item.payableAmount)}</div>
                        <div className="text-xs text-slate-400">
                          Paid {fmtMoney(item.paidAmount)} | Open {fmtMoney(item.remainingPayableAmount)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {settlementsPage.items.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400">
                        Ende nuk ka settlemente te TVSH-se per vitin e zgjedhur.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {preview?.existingSettlement?.payments?.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-base font-semibold text-slate-900">Historiku i pagesave</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Data
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Llogaria
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Shuma
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.existingSettlement.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 text-slate-600">{formatDateOnly(payment.transactionDate)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {payment.account.code} - {payment.account.name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {payment.referenceNo ?? payment.notes ?? '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtMoney(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
