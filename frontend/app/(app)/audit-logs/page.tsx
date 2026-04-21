import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function AuditLogsPage() {
  await requirePagePermission(PERMISSIONS.auditLogsRead);
  const logs = await api.list('audit-logs');

  return (
    <div>
      <PageHeader title="Regjistri i Auditimit" description="Gjurmimi i veprimeve në sistem." />
      <ServerDataTable
        data={logs}
        columns={[
          { key: 'entityType', title: 'Entiteti', render: (row: any) => row.entityType },
          { key: 'action', title: 'Veprimi', render: (row: any) => row.action },
          { key: 'entityId', title: 'ID Entitetit', render: (row: any) => row.entityId },
          { key: 'userId', title: 'ID Përdoruesit', render: (row: any) => row.userId ?? '-' },
          { key: 'createdAt', title: 'Krijuar Më', render: (row: any) => new Date(row.createdAt).toLocaleString() },
        ]}
      />
    </div>
  );
}
