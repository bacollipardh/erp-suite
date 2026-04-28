'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DomainActionCard } from '@/components/domain/domain-action-card';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { formatDateOnly } from '@/lib/date';

type FinanceAccount = {
  id: string;
  code: string;
  name: string;
  accountType: 'CASH' | 'BANK';
  currencyCode?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  currentBalance: number;
  openingBalance: number;
  isActive: boolean;
};

type FinanceTransaction = {
  id: string;
  transactionType: string;
  amount: number;
  transactionDate: string;
  referenceNo?: string | null;
  counterpartyName?: string | null;
  sourceDocumentType?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentNo?: string | null;
  notes?: string | null;
  balanceAfter: number;
  account: FinanceAccount;
};

function formatMoney(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function signedAmount(transaction: FinanceTransaction) {
  const inbound = ['OPENING', 'MANUAL_IN', 'TRANSFER_IN', 'RECEIPT'].includes(
    transaction.transactionType,
  );

  return inbound ? Number(transaction.amount ?? 0) : -Number(transaction.amount ?? 0);
}

function resolveDocumentHref(transaction: FinanceTransaction) {
  if (!transaction.sourceDocumentId || !transaction.sourceDocumentType) return null;
  if (transaction.sourceDocumentType === 'sales-invoices') {
    return `/sales-invoices/${transaction.sourceDocumentId}`;
  }
  if (transaction.sourceDocumentType === 'purchase-invoices') {
    return `/purchase-invoices/${transaction.sourceDocumentId}`;
  }
  return null;
}

function MoneyMetric({
  label,
  value,
  subtitle,
  tone = 'blue',
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">{value}</p>
          {subtitle ? <p className="mt-1.5 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${toneClass}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.9} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M12 3l9 5H3l9-5z" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-white px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {actions ? <div className="flex flex-col gap-2 sm:flex-row">{actions}</div> : null}
      </div>
      <div className="p-2 sm:p-4">{children}</div>
    </section>
  );
}

function inputClass() {
  return 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100';
}

export function FinanceAccountsOverviewClient({
  accounts,
  summary,
  transactions,
  transactionSummary,
  canManage,
}: {
  accounts: FinanceAccount[];
  summary: {
    totalBalance: number;
    cashBalance: number;
    bankBalance: number;
    accountCount: number;
    activeCount: number;
    negativeBalanceCount: number;
  };
  transactions: FinanceTransaction[];
  transactionSummary: {
    transactionCount: number;
    totalIn: number;
    totalOut: number;
    netChange: number;
  };
  canManage: boolean;
}) {
  const [accountSearch, setAccountSearch] = useState('');
  const [accountType, setAccountType] = useState<'ALL' | 'CASH' | 'BANK'>('ALL');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionType, setTransactionType] = useState('ALL');

  const filteredAccounts = useMemo(() => {
    const search = accountSearch.trim().toLowerCase();
    return accounts.filter((account) => {
      if (accountType !== 'ALL' && account.accountType !== accountType) return false;
      if (!search) return true;

      return [account.code, account.name, account.bankName, account.bankAccountNo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }, [accounts, accountSearch, accountType]);

  const availableTransactionTypes = useMemo(
    () => ['ALL', ...new Set(transactions.map((transaction) => transaction.transactionType))],
    [transactions],
  );

  const filteredTransactions = useMemo(() => {
    const search = transactionSearch.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (transactionType !== 'ALL' && transaction.transactionType !== transactionType) return false;
      if (!search) return true;

      return [
        transaction.account?.name,
        transaction.account?.code,
        transaction.referenceNo,
        transaction.counterpartyName,
        transaction.sourceDocumentNo,
        transaction.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }, [transactionSearch, transactionType, transactions]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#0B1220] p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">Treasury Control</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Likuiditeti dhe ledger-i financiar</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Pamje operative per cash, banka, transfere dhe levizje te audituara ne kohe reale.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/10">
              <p className="text-xs text-slate-400">Net Change</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(transactionSummary.netChange)} EUR</p>
            </div>
            <div className="rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/10">
              <p className="text-xs text-slate-400">Levizje</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{transactionSummary.transactionCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MoneyMetric label="Likuiditet Total" value={`${formatMoney(summary.totalBalance)} EUR`} tone="blue" />
        <MoneyMetric label="Cash" value={`${formatMoney(summary.cashBalance)} EUR`} tone="amber" />
        <MoneyMetric label="Banke" value={`${formatMoney(summary.bankBalance)} EUR`} tone="emerald" />
        <MoneyMetric label="Llogari Aktive" value={summary.activeCount} subtitle={`${summary.accountCount} gjithsej`} tone="slate" />
        <MoneyMetric
          label="Levizje Te Fundit"
          value={transactionSummary.transactionCount}
          subtitle={`${formatMoney(transactionSummary.netChange)} EUR neto`}
          tone="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {canManage ? (
          <DomainActionCard
            title="Llogari te Re"
            description="Krijo kase ose llogari bankare qe do te perdoren ne arketime, pagesa dhe reconciliations."
            href="/financa/llogarite/new"
            badge="Treasury"
            tone="indigo"
          />
        ) : null}
        {canManage ? (
          <DomainActionCard
            title="Transaksion Manual"
            description="Regjistro hyrje ose dalje direkt ne llogari pa kaluar neper dokument tregtar."
            href="/financa/transaksione/new"
            badge="Operative"
            tone="emerald"
          />
        ) : null}
        {canManage ? (
          <DomainActionCard
            title="Transfer Mes Llogarive"
            description="Leviz likuiditetin nga kasa ne banke ose mes llogarive me gjurme te plote."
            href="/financa/transfere/new"
            badge="Treasury"
            tone="amber"
          />
        ) : null}
      </div>

      <Panel
        title="Llogarite cash / bank"
        description="Ketu menaxhohen burimet reale te likuiditetit qe do te lidhen me arketimet, pagesat dhe reconciliations."
        actions={
          <>
            <input
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
              placeholder="Kerko llogari..."
              className={inputClass()}
            />
            <select
              value={accountType}
              onChange={(event) => setAccountType(event.target.value as 'ALL' | 'CASH' | 'BANK')}
              className={inputClass()}
            >
              <option value="ALL">Te gjitha</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Banke</option>
            </select>
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="rounded-l-xl bg-slate-50 px-4 py-3 text-left font-semibold">Kodi / Emri</th>
                <th className="bg-slate-50 px-4 py-3 text-left font-semibold">Tipi</th>
                <th className="bg-slate-50 px-4 py-3 text-left font-semibold">Detaje</th>
                <th className="bg-slate-50 px-4 py-3 text-right font-semibold">Balanca Hapese</th>
                <th className="bg-slate-50 px-4 py-3 text-right font-semibold">Balanca Aktuale</th>
                <th className="rounded-r-xl bg-slate-50 px-4 py-3 text-left font-semibold">Statusi</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="group">
                  <td className="border-b border-slate-100 px-4 py-4">
                    <p className="font-mono text-xs text-slate-500">{account.code}</p>
                    <p className="font-semibold text-slate-950">{account.name}</p>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4">
                    <StatusBadge value={account.accountType} />
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                    {account.accountType === 'BANK'
                      ? [account.bankName, account.bankAccountNo].filter(Boolean).join(' | ') || '-'
                      : 'Kase / Cash desk'}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4 text-right tabular-nums text-slate-600">
                    {formatMoney(account.openingBalance)} {account.currencyCode ?? 'EUR'}
                  </td>
                  <td className={`border-b border-slate-100 px-4 py-4 text-right tabular-nums font-semibold ${Number(account.currentBalance) < 0 ? 'text-rose-700' : 'text-slate-950'}`}>
                    {formatMoney(account.currentBalance)} {account.currencyCode ?? 'EUR'}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-4">
                    <StatusBadge value={account.isActive} />
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Nuk u gjet asnje llogari per filtrat aktuale.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Ledger i transaksioneve"
        description="Hyrjet, daljet, arketimet, pagesat dhe transfertat ruhen si levizje te audituara ne nivel llogarie."
        actions={
          <>
            <input
              value={transactionSearch}
              onChange={(event) => setTransactionSearch(event.target.value)}
              placeholder="Kerko levizje..."
              className={inputClass()}
            />
            <select
              value={transactionType}
              onChange={(event) => setTransactionType(event.target.value)}
              className={inputClass()}
            >
              {availableTransactionTypes.map((entry) => (
                <option key={entry} value={entry}>
                  {entry === 'ALL' ? 'Te gjitha' : entry}
                </option>
              ))}
            </select>
          </>
        }
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Hyrje" value={`${formatMoney(transactionSummary.totalIn)} EUR`} />
          <StatsCard title="Dalje" value={`${formatMoney(transactionSummary.totalOut)} EUR`} />
          <StatsCard title="Net Change" value={`${formatMoney(transactionSummary.netChange)} EUR`} />
          <StatsCard
            title="Balanca Negative"
            value={summary.negativeBalanceCount}
            subtitle="Kerkon kontroll financiar"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="rounded-l-xl bg-slate-50 px-4 py-3 text-left font-semibold">Data</th>
                <th className="bg-slate-50 px-4 py-3 text-left font-semibold">Llogaria</th>
                <th className="bg-slate-50 px-4 py-3 text-left font-semibold">Tipi</th>
                <th className="bg-slate-50 px-4 py-3 text-left font-semibold">Burimi</th>
                <th className="bg-slate-50 px-4 py-3 text-right font-semibold">Shuma</th>
                <th className="rounded-r-xl bg-slate-50 px-4 py-3 text-right font-semibold">Balanca Pas</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => {
                const amount = signedAmount(transaction);
                const href = resolveDocumentHref(transaction);
                return (
                  <tr key={transaction.id}>
                    <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{formatDateOnly(transaction.transactionDate)}</td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <p className="font-semibold text-slate-950">{transaction.account?.name}</p>
                      <p className="font-mono text-xs text-slate-500">{transaction.account?.code}</p>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4">
                      <StatusBadge value={transaction.transactionType} />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                      {href ? (
                        <Link href={href} className="font-medium text-blue-700 hover:text-blue-900">
                          {transaction.sourceDocumentNo}
                        </Link>
                      ) : transaction.sourceDocumentNo ? (
                        transaction.sourceDocumentNo
                      ) : transaction.counterpartyName ? (
                        transaction.counterpartyName
                      ) : (
                        transaction.referenceNo ?? '-'
                      )}
                    </td>
                    <td className={`border-b border-slate-100 px-4 py-4 text-right tabular-nums font-semibold ${amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {amount >= 0 ? '+' : '-'}{formatMoney(Math.abs(amount))} EUR
                    </td>
                    <td className="border-b border-slate-100 px-4 py-4 text-right tabular-nums text-slate-950">
                      {formatMoney(transaction.balanceAfter)} EUR
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Nuk ka levizje financiare per filtrat aktuale.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
