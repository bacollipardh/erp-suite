import { DomainActionCard } from '@/components/domain/domain-action-card';
import { PageHeader } from '@/components/page-header';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function AccountingLedgerHubPage() {
  const user = await requirePagePermission(PERMISSIONS.accountingRead);
  const canManage = hasPermission(user.permissions, PERMISSIONS.accountingManage);
  const canReports = hasPermission(user.permissions, PERMISSIONS.reportsAccounting);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Libri Kontabel"
        description="Zgjidh nje pamje te vetme: kontot, journal entries ose raportet kontabel."
        createHref="/financa/libri-kontabel/new"
        createLabel="Journal Manual"
        createPermission={PERMISSIONS.accountingManage}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DomainActionCard
          title="Kontot Kontabel"
          description="Chart of accounts, statusi i kontove dhe bilancet aktuale per secilen konto."
          href="/financa/libri-kontabel/kontot"
          badge="Accounts"
          tone="indigo"
        />
        <DomainActionCard
          title="Journal Entries"
          description="Hyrjet kontabel te gjeneruara nga dokumentet dhe journal-et manuale."
          href="/financa/libri-kontabel/journal"
          badge="Journal"
          tone="emerald"
        />
        {canReports ? (
          <DomainActionCard
            title="Raportet Kontabel"
            description="Trial balance, fitim-humbje, bilanci dhe TVSH ledger."
            href="/raportet/kontabiliteti"
            badge="Reports"
            tone="slate"
          />
        ) : null}
        {canManage ? (
          <DomainActionCard
            title="Mbyllja Kontabel"
            description="Preview dhe regjistrim i closing entries mujore."
            href="/financa/mbyllja-kontabel"
            badge="Close"
            tone="amber"
          />
        ) : null}
      </div>
    </div>
  );
}
