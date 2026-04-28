import { DomainActionCard } from '@/components/domain/domain-action-card';
import { PageHeader } from '@/components/page-header';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function AccountingReportsHubPage() {
  await requirePagePermission(PERMISSIONS.reportsAccounting);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Raportet Kontabel"
        description="Zgjidh nje raport kontabel te vetem per analize te paster dhe te lexueshme."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <DomainActionCard
          title="Trial Balance"
          description="Levizjet debit/credit dhe bilancet mbyllese per secilen konto."
          href="/raportet/kontabiliteti/trial-balance"
          badge="Ledger"
          tone="indigo"
        />
        <DomainActionCard
          title="Fitim-Humbje"
          description="Pasqyra e te ardhurave, shpenzimeve dhe rezultatit neto."
          href="/raportet/kontabiliteti/fitim-humbje"
          badge="P&L"
          tone="emerald"
        />
        <DomainActionCard
          title="Bilanci"
          description="Aktivet, detyrimet dhe kapitali ne daten e zgjedhur."
          href="/raportet/kontabiliteti/bilanci"
          badge="Balance"
          tone="slate"
        />
        <DomainActionCard
          title="TVSH Ledger"
          description="Regjistri i TVSH-se per hyrje, dalje dhe manual adjustments."
          href="/raportet/kontabiliteti/tvsh-ledger"
          badge="Tax"
          tone="amber"
        />
      </div>
    </div>
  );
}
