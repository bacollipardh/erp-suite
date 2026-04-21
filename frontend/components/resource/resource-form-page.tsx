import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { ResourceForm } from './resource-form';
import { resources } from '@/lib/resources';

async function loadOptions(resourceKey: string) {
  const config = resources[resourceKey];
  const optionFields = config.fields.filter((field) => field.type === 'select');

  const map: Record<string, any[]> = {};
  for (const field of optionFields) {
    const selectField = field as Extract<(typeof config.fields)[number], { type: 'select' }>;
    map[selectField.name] = await api.list(selectField.optionsEndpoint);
  }

  return map;
}

export async function ResourceCreatePage({ resourceKey }: { resourceKey: string }) {
  const config = resources[resourceKey];
  const optionsMap = await loadOptions(resourceKey);

  return (
    <div>
      <PageHeader title={`Krijo ${config.singular}`} description={config.description} />
      <ResourceForm resourceKey={resourceKey} mode="create" optionsMap={optionsMap} />
    </div>
  );
}

export async function ResourceEditPage({
  resourceKey,
  id,
}: {
  resourceKey: string;
  id: string;
}) {
  const config = resources[resourceKey];
  const [record, optionsMap] = await Promise.all([
    api.get(config.endpoint, id),
    loadOptions(resourceKey),
  ]);

  return (
    <div>
      <PageHeader title={`Ndrysho ${config.singular}`} description={config.description} />
      <ResourceForm resourceKey={resourceKey} mode="edit" record={record} optionsMap={optionsMap} />
    </div>
  );
}
