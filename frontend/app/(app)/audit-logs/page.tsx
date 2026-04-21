import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';

export default async function AuditLogsPage() {
  const logs = await api.list('audit-logs');

  return (
    <div>
      <PageHeader title="Regjistri i Auditimit" description="Gjurmimi i veprimeve në sistem." />
      <DataTable
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
