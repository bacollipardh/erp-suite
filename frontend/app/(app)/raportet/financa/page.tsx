import { DomainActionCard } from '@/components/domain/domain-action-card';
import { PageHeader } from '@/components/page-header';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

export default async function FinanceReportsHubPage() {
  const user = await requireAnyPagePermission([
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
    PERMISSIONS.financeAccountsRead,
  ]);

  const canReceivables = hasPermission(user.permissions, PERMISSIONS.reportsReceivables);
  const canPayables = hasPermission(user.permissions, PERMISSIONS.reportsPayables);
  const canFinanceAccounts = hasPermission(user.permissions, PERMISSIONS.financeAccountsRead);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Raportet Financiare"
        description="Zgjidh raportin financiar qe te duhet pa perzier receivables, payables dhe pajtimin bankar ne nje ekran."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {canReceivables ? (
          <DomainActionCard
            title="Raporti i Arketimeve"
            description="Receivables aging, debtor exposure dhe aktiviteti i arketimeve."
            href="/raportet/financa/arketimet"
            badge="Receivables"
            tone="indigo"
          />
        ) : null}
        {canPayables ? (
          <DomainActionCard
            title="Raporti i Pagesave"
            description="Payables aging, creditor exposure dhe aktiviteti i pagesave ndaj furnitoreve."
            href="/raportet/financa/pagesat"
            badge="Payables"
            tone="amber"
          />
        ) : null}
        {canFinanceAccounts ? (
          <DomainActionCard
            title="Raporti i Pajtimit Bankar"
            description="Raportim i statement lines, matches dhe diferencave te pajtimit bankar."
            href="/raportet/financa/pajtimi-bankar"
            badge="Bank"
            tone="emerald"
          />
        ) : null}
      </div>
    </div>
  );
}
