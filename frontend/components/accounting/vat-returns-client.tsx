'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { api, apiFetch } from '@/lib/api';
import { formatDateOnly, toDateInputValue } from '@/lib/date';

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

export type VatReturnsPage = {
  year: number;
  items: Array<{
    id: string;
    returnNo: string;
    declarationDate: string;
    dueDate?: string | null;
    status: 'DRAFT' | 'READY' | 'FILED';
    payableAmount: number;
    receivableAmount: number;
    filedAt?: string | null;
    filingReferenceNo?: string | null;
    period: {
      id: string;
      key: string;
      label: string;
      year: number;
      month: number;
    };
    settlement: {
      id: string;
      settlementNo: string;
      status: string;
      paidAmount: number;
      remainingPayableAmount: number;
    };
  }>;
  summary: {
    count: number;
    readyCount: number;
    filedCount: number;
    payableTotal: number;
    receivableTotal: number;
  };
};

export type VatReturnPreview = {
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
  company: {
    name: string;
    fiscalNo?: string | null;
    vatNo?: string | null;
    businessNo?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  canGenerate: boolean;
  isLocked: boolean;
  blockingReason?: string | null;
  settlement: {
    id: string;
    settlementNo: string;
    settlementDate: string;
    dueDate?: string | null;
    status: string;
    payableAmount: number;
    receivableAmount: number;
    paidAmount: number;
    remainingPayableAmount: number;
    filedAt?: string | null;
    filingReferenceNo?: string | null;
  } | null;
  proposed: {
    returnNo: string;
    declarationDate: string;
    dueDate?: string | null;
    currencyCode: string;
    status: string;
    outputTaxableBase: number;
    outputVat: number;
    inputTaxableBase: number;
    inputVat: number;
    manualOutputVat: number;
    manualInputVat: number;
    netVatAmount: number;
    payableAmount: number;
    receivableAmount: number;
    paidAmount: number;
    remainingPayableAmount: number;
    boxes: Array<{
      code: string;
      label: string;
      value: number;
    }>;
    metrics: {
      documentCount: number;
      manualAdjustmentCount: number;
    };
  } | null;
  existingReturn: {
    id: string;
    returnNo: string;
    declarationDate: string;
    dueDate?: string | null;
    status: 'DRAFT' | 'READY' | 'FILED';
    filedAt?: string | null;
    filingReferenceNo?: string | null;
    notes?: string | null;
    settlement: {
      settlementNo: string;
      paidAmount: number;
      remainingPayableAmount: number;
    };
    declaration: {
      boxes: Array<{
        code: string;
        label: string;
        value: number;
      }>;
      metrics?: {
        documentCount: number;
        manualAdjustmentCount: number;
      } | null;
    };
    exports: {
      csvPath: string;
      jsonPath: string;
      pdfPath: string;
      pdfPreviewPath: string;
      baseName: string;
    };
  } | null;
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

  return 'Ndodhi nje gabim gjate perpunimit te deklarates se TVSH-se.';
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

function triggerDownload(path: string) {
  const link = document.createElement('a');
  link.href = `/api/proxy${path}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openPreview(path: string) {
  window.open(`/api/proxy${path}`, '_blank', 'noopener,noreferrer');
}

export function VatReturnsClient({
  initialYear,
  initialPeriods,
  initialReturns,
  initialPreview,
  canManage,
}: {
  initialYear: number;
  initialPeriods: VatFinancialPeriodsPage;
  initialReturns: VatReturnsPage;
  initialPreview: VatReturnPreview | null;
  canManage: boolean;
}) {
  const [year, setYear] = useState(initialYear);
  const [periodsPage, setPeriodsPage] = useState(initialPeriods);
  const [returnsPage, setReturnsPage] = useState(initialReturns);
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    initialPreview?.period.id ?? initialPeriods.currentPeriodId ?? initialPeriods.items[0]?.id ?? '',
  );
  const [preview, setPreview] = useState<VatReturnPreview | null>(initialPreview);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [declarationDate, setDeclarationDate] = useState(
    toDateInputValue(initialPreview?.proposed?.declarationDate ?? new Date()),
  );
  const [notes, setNotes] = useState(initialPreview?.existingReturn?.notes ?? '');
  const [filingDate, setFilingDate] = useState(
    initialPreview?.existingReturn?.filedAt
      ? toDateInputValue(initialPreview.existingReturn.filedAt)
      : toDateInputValue(new Date()),
  );
  const [filingReferenceNo, setFilingReferenceNo] = useState(
    initialPreview?.existingReturn?.filingReferenceNo ?? '',
  );

  useEffect(() => {
    if (!preview) return;
    setDeclarationDate(
      toDateInputValue(preview.existingReturn?.declarationDate ?? preview.proposed?.declarationDate ?? new Date()),
    );
    setNotes(preview.existingReturn?.notes ?? '');
    setFilingDate(
      preview.existingReturn?.filedAt
        ? toDateInputValue(preview.existingReturn.filedAt)
        : toDateInputValue(new Date()),
    );
    setFilingReferenceNo(preview.existingReturn?.filingReferenceNo ?? '');
  }, [preview]);

  async function loadPreview(periodId: string) {
    if (!periodId) {
      setPreview(null);
      return;
    }

    const response = await api.fetch<VatReturnPreview>(
      `/vat-returns/preview?financialPeriodId=${periodId}`,
    );
    setPreview(response);
  }

  async function refreshContext(nextYear = year, nextPeriodId = selectedPeriodId) {
    const [returnsResponse, previewResponse] = await Promise.all([
      api.query<VatReturnsPage>('vat-returns', { year: nextYear }),
      nextPeriodId
        ? api.fetch<VatReturnPreview>(
            `/vat-returns/preview?financialPeriodId=${nextPeriodId}`,
          )
        : Promise.resolve(null),
    ]);

    setReturnsPage(returnsResponse);
    setPreview(previewResponse);
  }

  async function loadYear(nextYear: number) {
    setBusy('year');
    setError(null);
    setFeedback(null);

    try {
      const [periodsResponse, returnsResponse] = await Promise.all([
        api.query<VatFinancialPeriodsPage>('financial-periods', { year: nextYear }),
        api.query<VatReturnsPage>('vat-returns', { year: nextYear }),
      ]);

      const nextPeriodId =
        periodsResponse.currentPeriodId ?? periodsResponse.items[0]?.id ?? '';

      setYear(nextYear);
      setPeriodsPage(periodsResponse);
      setReturnsPage(returnsResponse);
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

    setBusy('save');
    setError(null);
    setFeedback(null);

    try {
      await api.post('vat-returns', {
        financialPeriodId: selectedPeriodId,
        declarationDate,
        notes: notes.trim() || undefined,
      });

      await refreshContext(year, selectedPeriodId);
      setFeedback('Deklarata mujore e TVSH-se u ruajt me sukses.');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleFile() {
    if (!preview?.existingReturn?.id) return;

    setBusy('file');
    setError(null);
    setFeedback(null);

    try {
      await apiFetch(`/vat-returns/${preview.existingReturn.id}/file`, {
        method: 'PATCH',
        body: JSON.stringify({
          filedAt: filingDate,
          filingReferenceNo: filingReferenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      await refreshContext(year, selectedPeriodId);
      setFeedback('Deklarata e TVSH-se u shenua si e deklaruar.');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  const boxes = preview?.existingReturn?.declaration.boxes ?? preview?.proposed?.boxes ?? [];
  const metrics =
    preview?.existingReturn?.declaration.metrics ?? preview?.proposed?.metrics ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Deklarata"
          value={returnsPage.summary.count}
          sub={`${returnsPage.summary.filedCount} te deklaruara`}
        />
        <MetricCard
          label="Gati per filing"
          value={returnsPage.summary.readyCount}
          sub="Draft / ready ne vitin e zgjedhur"
        />
        <MetricCard
          label="TVSH per pagese"
          value={fmtMoney(returnsPage.summary.payableTotal)}
          sub="Totali i deklaratave te ruajtura"
        />
        <MetricCard
          label="TVSH per rimbursim"
          value={fmtMoney(returnsPage.summary.receivableTotal)}
          sub="Balanca kreditore e TVSH-se"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Deklarata mujore</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gjenero snapshot-in e deklarates nga settlement-i i TVSH-se dhe eksportoje
              ne format te strukturuar per dorezim, kontroll dhe arkivim.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => loadYear(year - 1)}
              disabled={busy !== null}
            >
              Viti {year - 1}
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => loadYear(year + 1)}
              disabled={busy !== null}
            >
              Viti {year + 1}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Periudha</span>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400"
              value={selectedPeriodId}
              onChange={(event) => handlePeriodChange(event.target.value)}
            >
              {periodsPage.items.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Viti aktiv: <strong className="text-slate-900">{year}</strong>
              </span>
              <span>
                Status periudhe:{' '}
                <StatusBadge value={preview?.period.status ?? periodsPage.items[0]?.status} />
              </span>
              {busy ? <span className="text-indigo-600">Po rifreskohet...</span> : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {feedback ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        ) : null}
      </div>

      {preview?.blockingReason ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-amber-900">Settlement-i mungon</h3>
          <p className="mt-2 text-sm text-amber-800">{preview.blockingReason}</p>
          <div className="mt-4">
            <Link
              href="/financa/tvsh"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Shko te TVSH &amp; Taksat
            </Link>
          </div>
        </div>
      ) : null}

      {!preview?.blockingReason && preview ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {preview.existingReturn?.returnNo ?? preview.proposed?.returnNo ?? 'Deklarata'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Periudha {preview.period.label} mbi settlement-in{' '}
                    <strong>{preview.settlement?.settlementNo ?? '-'}</strong>.
                  </p>
                </div>
                <StatusBadge
                  value={preview.existingReturn?.status ?? preview.proposed?.status ?? 'DRAFT'}
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Kompania
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{preview.company.name}</p>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <p>Nr. fiskal: {preview.company.fiscalNo ?? '-'}</p>
                    <p>Nr. TVSH: {preview.company.vatNo ?? '-'}</p>
                    <p>Adresa: {preview.company.address ?? '-'}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Settlement status
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge value={preview.settlement?.status ?? '-'} />
                    {preview.settlement?.filedAt ? (
                      <span className="text-xs text-slate-500">
                        filing {formatDateOnly(preview.settlement.filedAt)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <p>Pagese: {fmtMoney(preview.settlement?.paidAmount ?? 0)}</p>
                    <p>Mbetje: {fmtMoney(preview.settlement?.remainingPayableAmount ?? 0)}</p>
                    <p>Afati: {formatDateOnly(preview.settlement?.dueDate ?? null)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Data e deklarates</span>
                  <input
                    type="date"
                    value={declarationDate}
                    onChange={(event) => setDeclarationDate(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                    disabled={!canManage || preview.isLocked}
                  />
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p>Dokumente ne VAT ledger: {metrics?.documentCount ?? 0}</p>
                  <p className="mt-1">
                    Rregullime manuale: {metrics?.manualAdjustmentCount ?? 0}
                  </p>
                  <p className="mt-1">
                    Filing ref: {preview.existingReturn?.filingReferenceNo ?? '-'}
                  </p>
                </div>
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-slate-700">Shenime</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                  disabled={!canManage}
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                {canManage ? (
                  <button
                    type="button"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
                    onClick={handleCreateOrUpdate}
                    disabled={busy !== null || !preview.canGenerate}
                  >
                    {preview.existingReturn ? 'Perditeso deklaraten' : 'Gjenero deklaraten'}
                  </button>
                ) : null}
                {preview.isLocked ? (
                  <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Deklarata eshte filing dhe rigjenerimi eshte i bllokuar.
                  </span>
                ) : null}
              </div>

              {preview.existingReturn ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Filing & export</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Eksportet gjenerohen nga snapshot-i i ruajtur ne backend.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                        onClick={() => triggerDownload(preview.existingReturn!.exports.csvPath)}
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                        onClick={() => triggerDownload(preview.existingReturn!.exports.jsonPath)}
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                        onClick={() => openPreview(preview.existingReturn!.exports.pdfPreviewPath)}
                      >
                        PDF Preview
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                        onClick={() => triggerDownload(preview.existingReturn!.exports.pdfPath)}
                      >
                        PDF
                      </button>
                    </div>
                  </div>

                  {canManage ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Data e filing</span>
                        <input
                          type="date"
                          value={filingDate}
                          onChange={(event) => setFilingDate(event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                        />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-medium text-slate-700">
                          Referenca e filing
                        </span>
                        <input
                          type="text"
                          value={filingReferenceNo}
                          onChange={(event) => setFilingReferenceNo(event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                          placeholder="Opsionale"
                        />
                      </label>
                    </div>
                  ) : null}

                  {canManage ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                        onClick={handleFile}
                        disabled={busy !== null}
                      >
                        {preview.existingReturn.filedAt ? 'Perditeso filing' : 'Sheno si te deklaruar'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Kutite e deklarates</h3>
              <p className="mt-1 text-sm text-slate-500">
                Vlerat dalin nga settlement-i dhe VAT ledger-i i periudhes se zgjedhur.
              </p>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Kodi</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Pershkrimi</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">Vlera</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {boxes.map((box) => (
                      <tr key={box.code}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{box.code}</td>
                        <td className="px-4 py-3 text-slate-600">{box.label}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {fmtMoney(box.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Rezultati fiskal</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Per pagese</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {fmtMoney(preview.proposed?.payableAmount ?? preview.existingReturn?.settlement.remainingPayableAmount ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Per rimbursim</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {fmtMoney(preview.proposed?.receivableAmount ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Paguar</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {fmtMoney(preview.settlement?.paidAmount ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Mbetja</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {fmtMoney(preview.settlement?.remainingPayableAmount ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Historiku i deklaratave</h3>
            <p className="mt-1 text-sm text-slate-500">
              Deklaratat e ruajtura per vitin e zgjedhur, me statusin e filing dhe settlement-it.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Deklarata</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Periudha</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Settlement</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Pagese</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Rimbursim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {returnsPage.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Ende nuk ka deklarata te ruajtura per kete vit.
                  </td>
                </tr>
              ) : (
                returnsPage.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.returnNo}</div>
                      <div className="text-xs text-slate-500">
                        {formatDateOnly(item.declarationDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.period.label}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.settlement.settlementNo}</div>
                      <div className="text-xs text-slate-500">
                        Mbetje {fmtMoney(item.settlement.remainingPayableAmount)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {fmtMoney(item.payableAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {fmtMoney(item.receivableAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
