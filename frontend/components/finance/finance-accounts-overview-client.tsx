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
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatsCard title="Likuiditet Total" value={`${formatMoney(summary.totalBalance)} EUR`} />
        <StatsCard title="Cash" value={`${formatMoney(summary.cashBalance)} EUR`} />
        <StatsCard title="Banke" value={`${formatMoney(summary.bankBalance)} EUR`} />
        <StatsCard title="Llogari Aktive" value={summary.activeCount} subtitle={`${summary.accountCount} gjithsej`} />
        <StatsCard
          title="Levizje Te Fundit"
          value={transactionSummary.transactionCount}
          subtitle={`${formatMoney(transactionSummary.netChange)} EUR neto`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Llogarite cash / bank</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ketu menaxhohen burimet reale te likuiditetit qe do te lidhen me arketimet, pagesat dhe reconciliations.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
              placeholder="Kerko llogari..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={accountType}
              onChange={(event) => setAccountType(event.target.value as 'ALL' | 'CASH' | 'BANK')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL">Te gjitha</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Banke</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Kodi / Emri</th>
                <th className="px-3 py-2 text-left font-medium">Tipi</th>
                <th className="px-3 py-2 text-left font-medium">Detaje</th>
                <th className="px-3 py-2 text-right font-medium">Balanca Hapese</th>
                <th className="px-3 py-2 text-right font-medium">Balanca Aktuale</th>
                <th className="px-3 py-2 text-left font-medium">Statusi</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <p className="font-mono text-xs text-slate-500">{account.code}</p>
                    <p className="font-medium text-slate-900">{account.name}</p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge value={account.accountType} />
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {account.accountType === 'BANK'
                      ? [account.bankName, account.bankAccountNo].filter(Boolean).join(' | ') || '-'
                      : 'Kase / Cash desk'}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                    {formatMoney(account.openingBalance)} {account.currencyCode ?? 'EUR'}
                  </td>
                  <td className={`px-3 py-3 text-right tabular-nums font-semibold ${Number(account.currentBalance) < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                    {formatMoney(account.currentBalance)} {account.currencyCode ?? 'EUR'}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge value={account.isActive} />
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    Nuk u gjet asnje llogari per filtrat aktuale.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Ledger i transaksioneve</h2>
            <p className="mt-1 text-sm text-slate-500">
              Hyrjet, daljet, arketimet, pagesat dhe transfertat ruhen si levizje te audituara ne nivel llogarie.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={transactionSearch}
              onChange={(event) => setTransactionSearch(event.target.value)}
              placeholder="Kerko levizje..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={transactionType}
              onChange={(event) => setTransactionType(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {availableTransactionTypes.map((entry) => (
                <option key={entry} value={entry}>
                  {entry === 'ALL' ? 'Te gjitha' : entry}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
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
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-left font-medium">Llogaria</th>
                <th className="px-3 py-2 text-left font-medium">Tipi</th>
                <th className="px-3 py-2 text-left font-medium">Burimi</th>
                <th className="px-3 py-2 text-right font-medium">Shuma</th>
                <th className="px-3 py-2 text-right font-medium">Balanca Pas</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => {
                const amount = signedAmount(transaction);
                const href = resolveDocumentHref(transaction);
                return (
                  <tr key={transaction.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 text-slate-600">{formatDateOnly(transaction.transactionDate)}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{transaction.account?.name}</p>
                      <p className="font-mono text-xs text-slate-500">{transaction.account?.code}</p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge value={transaction.transactionType} />
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {href ? (
                        <Link href={href} className="text-indigo-700 hover:text-indigo-900">
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
                    <td className={`px-3 py-3 text-right tabular-nums font-semibold ${amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {amount >= 0 ? '+' : '-'}{formatMoney(Math.abs(amount))} EUR
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-900">
                      {formatMoney(transaction.balanceAfter)} EUR
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    Nuk ka levizje financiare per filtrat aktuale.
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
