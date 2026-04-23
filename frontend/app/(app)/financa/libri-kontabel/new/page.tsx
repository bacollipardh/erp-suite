import { PageHeader } from '@/components/page-header';
import { ManualJournalEntryForm } from '@/components/accounting/manual-journal-entry-form';
import { PERMISSIONS } from '@/lib/permissions';
import { api } from '@/lib/api';
import { requirePagePermission } from '@/lib/server-page-auth';

type ManualAccountsPage = {
  items: Array<{
    id: string;
    code: string;
    name: string;
    reportSectionLabel: string;
  }>;
};

export default async function NewManualJournalEntryPage() {
  await requirePagePermission(PERMISSIONS.accountingManage);

  const accountsPage = await api.listPage<ManualAccountsPage>('accounting/accounts', {
    allowManual: true,
    isActive: true,
    limit: 100,
    sortBy: 'code',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal Entry Manuale"
        description="Regjistro accruals, deferrals, VAT adjustments dhe hyrje te tjera kontabel qe nuk krijohen automatikisht nga dokumentet."
      />
      <ManualJournalEntryForm accounts={accountsPage.items} />
    </div>
  );
}
