import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type AuditLogRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  user?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
  } | null;
};

type AuditLogPageResponse = {
  items: AuditLogRow[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('sq-AL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    return value.toLocaleString('sq-AL', {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 3,
    });
  }
  if (typeof value === 'boolean') return value ? 'Po' : 'Jo';
  if (Array.isArray(value)) return value.join(', ') || '-';
  if (isPlainObject(value)) return JSON.stringify(value);
  return String(value);
}

function getPriorityMetadataEntries(metadata?: Record<string, unknown> | null) {
  if (!isPlainObject(metadata)) return [];

  const priorityKeys = [
    'docNo',
    'reason',
    'skipWmsReason',
    'referenceNo',
    'amount',
    'enteredAmount',
    'appliedAmount',
    'unappliedAmount',
    'warehouseId',
    'totalQty',
    'lineCount',
    'wmsMode',
  ];

  const taken = new Set<string>();
  const entries: [string, unknown][] = [];

  for (const key of priorityKeys) {
    if (metadata[key] !== undefined) {
      entries.push([key, metadata[key]]);
      taken.add(key);
    }
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (!taken.has(key)) entries.push([key, value]);
  }

  return entries;
}

function prettifyKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string }>;
}) {
  await requirePagePermission(PERMISSIONS.auditLogsRead);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const logs = await api.listPage<AuditLogPageResponse>('audit-logs', {
    search: resolvedSearchParams.search,
    limit: 100,
  });
  const items = logs.items ?? [];

  const bypassCount = items.filter((row) => row.action === 'WMS_BYPASS_POST').length;
  const paymentCount = items.filter((row) => row.action === 'RECORD_PAYMENT').length;
  const operatorCount = new Set(
    items
      .map((row) => row.user?.id ?? null)
      .filter((value): value is string => Boolean(value)),
  ).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regjistri i Auditimit"
        description={
          resolvedSearchParams.search
            ? `Gjurmimi i veprimeve i filtruar per ${resolvedSearchParams.search}.`
            : 'Gjurmimi i veprimeve ne sistem, me theks te operatori, arsyeja dhe metadata operative.'
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Rreshta Audit" value={logs.total ?? items.length} subtitle="Rezultatet e filtrit aktiv" />
        <StatsCard title="Bypass WMS" value={bypassCount} subtitle="Ne 100 hyrjet e fundit" />
        <StatsCard title="Regjistrime Pagesash" value={paymentCount} subtitle="Audit financiar" />
        <StatsCard title="Operatorë" value={operatorCount} subtitle="Perdorues unik ne rezultat" />
      </div>
      <ServerDataTable
        data={items}
        columns={[
          {
            key: 'entityType',
            title: 'Entiteti',
            render: (row: AuditLogRow) => (
              <div className="min-w-[220px] whitespace-normal">
                <p className="font-medium text-slate-900">{row.entityType}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{row.entityId}</p>
              </div>
            ),
          },
          {
            key: 'action',
            title: 'Veprimi',
            render: (row: AuditLogRow) => (
              <div className="min-w-[180px] whitespace-normal">
                <p className="font-semibold text-slate-900">{row.action}</p>
                {row.action === 'WMS_BYPASS_POST' ? (
                  <div className="mt-2">
                    <StatusBadge value="BYPASS" />
                  </div>
                ) : row.action === 'POST' ? (
                  <div className="mt-2">
                    <StatusBadge value="POSTED" />
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            key: 'user',
            title: 'Operatori',
            render: (row: AuditLogRow) => (
              <div className="min-w-[180px] whitespace-normal">
                <p className="font-medium text-slate-900">
                  {row.user?.fullName ?? row.user?.email ?? 'Pa operator'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.user?.email ?? '-'}
                </p>
              </div>
            ),
          },
          {
            key: 'metadata',
            title: 'Detajet',
            render: (row: AuditLogRow) => {
              const entries = getPriorityMetadataEntries(row.metadata).slice(0, 6);
              return (
                <div className="min-w-[320px] whitespace-normal">
                  {entries.length ? (
                    <div className="space-y-1.5">
                      {entries.map(([key, value]) => (
                        <p key={key} className="text-xs text-slate-600">
                          <span className="font-medium text-slate-800">{prettifyKey(key)}:</span>{' '}
                          <span className="break-all">{formatAuditValue(value)}</span>
                        </p>
                      ))}
                      {getPriorityMetadataEntries(row.metadata).length > entries.length ? (
                        <p className="text-xs text-slate-400">
                          +{getPriorityMetadataEntries(row.metadata).length - entries.length} fusha tjera
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Pa metadata shtese</span>
                  )}
                </div>
              );
            },
          },
          {
            key: 'createdAt',
            title: 'Koha',
            render: (row: AuditLogRow) => (
              <div className="min-w-[150px] whitespace-normal text-sm text-slate-700">
                {formatDateTime(row.createdAt)}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
