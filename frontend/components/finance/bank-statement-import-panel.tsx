'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type FinanceAccountOption = {
  id: string;
  code: string;
  name: string;
  accountType: 'CASH' | 'BANK';
  currentBalance: number;
  currencyCode?: string | null;
};

type ImportRow = {
  rowNo: number;
  direction: 'IN' | 'OUT';
  statementDate: string;
  valueDate?: string;
  amount: number;
  statementBalance?: number;
  referenceNo?: string;
  externalId?: string;
  counterpartyName?: string;
  description?: string;
  notes?: string;
};

type ImportResult = {
  importBatchId: string;
  summary: {
    requestedRows: number;
    importedCount: number;
    skippedCount: number;
    duplicateCount: number;
    autoMatchedCount: number;
    ambiguousAutoMatchCount: number;
  };
  results: {
    rowNo: number;
    status: string;
    message: string;
    statementLineId?: string;
    matchedTransactionId?: string | null;
    referenceNo?: string | null;
    externalId?: string | null;
    amount: number;
  }[];
};

const TEMPLATE_HEADER = [
  'statementDate',
  'direction',
  'amount',
  'referenceNo',
  'externalId',
  'counterpartyName',
  'description',
  'valueDate',
  'statementBalance',
  'notes',
].join(',');

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsv(text: string) {
  const sample = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const delimiter = [',', ';', '\t'].sort(
    (left, right) => sample.split(right).length - sample.split(left).length,
  )[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((entry) => entry !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((entry) => entry !== '')) rows.push(row);
  return rows;
}

function parseMoney(value?: string) {
  const raw = String(value ?? '').replace(/\s/g, '').replace(/eur/gi, '').trim();
  if (!raw) return null;

  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  let normalized = raw;

  if (comma >= 0 && dot >= 0) {
    normalized =
      comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (comma >= 0) {
    normalized = raw.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value?: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const parts = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!parts) return null;

  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const year = Number(parts[3]);
  const day = first > 12 ? first : second > 12 ? second : first;
  const month = first > 12 ? second : second > 12 ? first : second;
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}

function parseDirection(value?: string, amount?: number | null) {
  const raw = normalizeHeader(value ?? '');
  if (['in', 'hyrje', 'credit', 'kredit', 'cr', 'c'].includes(raw)) return 'IN';
  if (['out', 'dalje', 'debit', 'debitim', 'dr', 'd'].includes(raw)) return 'OUT';
  if (amount !== null && amount !== undefined) return amount < 0 ? 'OUT' : 'IN';
  return null;
}

function getValue(record: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[normalizeHeader(alias)];
    if (value !== undefined && value !== '') return value;
  }
  return '';
}

function mapCsvRows(text: string) {
  const rows = parseCsv(text);
  const errors: string[] = [];
  const mappedRows: ImportRow[] = [];

  if (rows.length < 2) {
    return {
      rows: mappedRows,
      errors: ['File duhet te kete header dhe se paku nje rresht me te dhena.'],
    };
  }

  const headers = rows[0].map(normalizeHeader);
  rows.slice(1).forEach((cells, index) => {
    const rowNo = index + 2;
    const record = headers.reduce<Record<string, string>>((acc, header, cellIndex) => {
      acc[header] = cells[cellIndex] ?? '';
      return acc;
    }, {});

    const debit = parseMoney(getValue(record, ['debit', 'dalje', 'amountOut']));
    const credit = parseMoney(getValue(record, ['credit', 'hyrje', 'amountIn']));
    const rawAmount = parseMoney(getValue(record, ['amount', 'shuma', 'value']));
    const amountSource = credit && credit > 0 ? credit : debit && debit > 0 ? -debit : rawAmount;
    const direction = parseDirection(getValue(record, ['direction', 'drejtimi', 'type']), amountSource);
    const amount = amountSource === null || amountSource === undefined ? null : Math.abs(amountSource);
    const statementDate = parseDate(getValue(record, ['statementDate', 'date', 'data', 'bookingDate']));
    const valueDate = parseDate(getValue(record, ['valueDate', 'dataVleres']));
    const statementBalance = parseMoney(getValue(record, ['statementBalance', 'balance', 'balanca']));

    if (!statementDate) errors.push(`Rreshti ${rowNo}: data nuk eshte valide.`);
    if (!direction) errors.push(`Rreshti ${rowNo}: drejtimi mungon ose nuk njihet.`);
    if (!amount || amount <= 0) errors.push(`Rreshti ${rowNo}: shuma mungon ose nuk eshte valide.`);

    if (!statementDate || !direction || !amount || amount <= 0) return;

    mappedRows.push({
      rowNo,
      direction,
      statementDate,
      valueDate: valueDate ?? undefined,
      amount,
      statementBalance: statementBalance ?? undefined,
      referenceNo: getValue(record, ['referenceNo', 'reference', 'ref', 'referenca']) || undefined,
      externalId: getValue(record, ['externalId', 'transactionId', 'id', 'bankId']) || undefined,
      counterpartyName:
        getValue(record, ['counterpartyName', 'counterparty', 'party', 'pala', 'beneficiary']) ||
        undefined,
      description: getValue(record, ['description', 'pershkrimi', 'details']) || undefined,
      notes: getValue(record, ['notes', 'shenime']) || undefined,
    });
  });

  return { rows: mappedRows, errors };
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

  return 'Ndodhi nje gabim gjate importit.';
}

function formatMoney(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function BankStatementImportPanel({
  bankAccounts,
  onImported,
}: {
  bankAccounts: FinanceAccountOption[];
  onImported: (result: ImportResult) => void;
}) {
  const [financeAccountId, setFinanceAccountId] = useState(bankAccounts[0]?.id ?? '');
  const [autoMatch, setAutoMatch] = useState(true);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  function downloadTemplate() {
    const blob = new Blob([`${TEMPLATE_HEADER}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bank-statement-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRows([]);
    setParseErrors([]);
    setResult(null);
    setError(null);

    if (!file) {
      setFileName('');
      return;
    }

    setFileName(file.name);

    if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      setParseErrors([
        'Per Excel .xlsx, hape file-in ne Excel dhe ruaje si CSV ose TSV, pastaj ngarko CSV-ne ketu.',
      ]);
      return;
    }

    const text = await file.text();
    const parsed = mapCsvRows(text);
    setRows(parsed.rows);
    setParseErrors(parsed.errors);
  }

  async function handleImport() {
    if (!financeAccountId || rows.length === 0 || parseErrors.length > 0) return;

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const payload = (await api.post('finance-reconciliation/statement-lines/import', {
        financeAccountId,
        autoMatch,
        lines: rows,
      })) as ImportResult;

      setResult(payload);
      onImported(payload);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Import statement bankar</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ngarko CSV/TSV nga banka ose file te ruajtur nga Excel si CSV. Auto-match behet vetem kur kandidati eshte unik.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
        >
          Shkarko template CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Llogaria bankare</span>
          <select
            value={financeAccountId}
            onChange={(event) => setFinanceAccountId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">CSV / TSV file</span>
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            onChange={handleFileChange}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={autoMatch}
            onChange={(event) => setAutoMatch(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Auto-match
        </label>
      </div>

      {fileName ? (
        <p className="text-xs text-slate-500">
          File i zgjedhur: <span className="font-medium text-slate-700">{fileName}</span>
        </p>
      ) : null}

      {parseErrors.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {parseErrors.slice(0, 5).map((entry) => (
            <p key={entry}>{entry}</p>
          ))}
          {parseErrors.length > 5 ? <p>... edhe {parseErrors.length - 5} gabime tjera</p> : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {rows.length > 0 && parseErrors.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">
              Gati per import: {rows.length} rreshta
            </p>
            <button
              type="button"
              onClick={handleImport}
              disabled={busy || !financeAccountId}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Duke importuar...' : 'Importo statement'}
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Rreshti</th>
                  <th className="px-2 py-2 text-left font-medium">Data</th>
                  <th className="px-2 py-2 text-left font-medium">Drejtimi</th>
                  <th className="px-2 py-2 text-left font-medium">Reference</th>
                  <th className="px-2 py-2 text-left font-medium">Pala</th>
                  <th className="px-2 py-2 text-right font-medium">Shuma</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNo} className="border-t border-slate-100">
                    <td className="px-2 py-2">{row.rowNo}</td>
                    <td className="px-2 py-2">{row.statementDate}</td>
                    <td className="px-2 py-2">{row.direction}</td>
                    <td className="px-2 py-2">{row.referenceNo ?? '-'}</td>
                    <td className="px-2 py-2">{row.counterpartyName ?? '-'}</td>
                    <td className="px-2 py-2 text-right">{formatMoney(row.amount)} EUR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <p className="font-semibold">Importi perfundoi</p>
          <p className="mt-1">
            {result.summary.importedCount} te importuara, {result.summary.autoMatchedCount} auto-match,{' '}
            {result.summary.skippedCount} te anashkaluara.
          </p>
        </div>
      ) : null}
    </div>
  );
}
