import { PageHeader } from '@/components/page-header';
import { VatSettlementsClient } from '@/components/accounting/vat-settlements-client';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type FinancialPeriodsPage = {
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

type VatSettlementsPage = {
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

type VatSettlementPreview = {
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

type FinanceAccountsPage = {
  items: Array<{
    id: string;
    code: string;
    name: string;
    accountType: 'CASH' | 'BANK';
    currentBalance: number;
  }>;
};

export default async function VatSettlementsPage() {
  const user = await requirePagePermission(PERMISSIONS.accountingRead);
  const currentYear = new Date().getUTCFullYear();
  const canManage = hasPermission(user.permissions, PERMISSIONS.accountingManage);
  const canFinanceAccounts = hasPermission(user.permissions, PERMISSIONS.financeAccountsRead);

  const [periodsPage, settlementsPage, financeAccountsPage] = await Promise.all([
    api.query<FinancialPeriodsPage>('financial-periods', { year: currentYear }),
    api.query<VatSettlementsPage>('vat-settlements', { year: currentYear }),
    canFinanceAccounts
      ? api.query<FinanceAccountsPage>('finance-accounts', {
          isActive: true,
          limit: 100,
          sortBy: 'name',
          sortOrder: 'asc',
        })
      : Promise.resolve({ items: [] }),
  ]);

  const currentPeriodId = periodsPage.currentPeriodId ?? periodsPage.items[0]?.id ?? null;
  const initialPreview = currentPeriodId
    ? await api.fetch<VatSettlementPreview>(
        `/vat-settlements/preview?financialPeriodId=${currentPeriodId}`,
      )
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="TVSH & Taksat"
        description="Mbyllja mujore e TVSH-se, filing reference, pagesa nga banka dhe raporti i taksave mbi ledger-in real."
      />
      <VatSettlementsClient
        initialYear={currentYear}
        initialPeriods={periodsPage}
        initialSettlements={settlementsPage}
        initialPreview={initialPreview}
        financeAccounts={financeAccountsPage.items}
        canManage={canManage}
      />
    </div>
  );
}
