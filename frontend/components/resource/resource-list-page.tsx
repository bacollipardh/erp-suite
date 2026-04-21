import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { getValueByPath, resources } from '@/lib/resources';

export async function ResourceListPage({ resourceKey }: { resourceKey: string }) {
  const config = resources[resourceKey];
  const rows = await api.list(config.endpoint);

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        createHref={`/${resourceKey}/new`}
        createLabel={`Krijo ${config.singular}`}
      />

      <DataTable
        data={rows}
        detailsBasePath={`/${resourceKey}`}
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
