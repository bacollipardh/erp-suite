import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { getValueByPath, resources } from '@/lib/resources';
import { hasPermission } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export async function ResourceListPage({ resourceKey }: { resourceKey: string }) {
  const config = resources[resourceKey];
  const user = await requirePagePermission(config.readPermission);
  const rows = await api.list(config.endpoint);

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        createHref={`/${resourceKey}/new`}
        createLabel={`Krijo ${config.singular}`}
        createPermission={config.managePermission}
      />

      <ServerDataTable
        data={rows}
        detailsBasePath={`/${resourceKey}`}
        canOpenDetails={hasPermission(user.permissions, config.managePermission)}
        columns={config.listColumns.map((column) => ({
          key: column.key,
          title: column.title,
          render: (row: any) => {
            const value = getValueByPath(row, column.key);
            if (column.renderType === 'boolean') {
              return <StatusBadge value={value} />;
            }
            if (column.renderType === 'status') {
              return <StatusBadge value={value} />;
            }
            return value ?? '-';
          },
        }))}
      />
    </div>
  );
}
