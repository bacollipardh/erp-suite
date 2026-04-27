import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { PolicyAdminPanel } from '@/components/approvals/policy-admin-panel';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type Policy = {
  id: string;
  code: string;
  name: string;
  entityType: string;
  action: string;
  minAmount: number | null;
  maxAmount: number | null;
  requiredSteps: number;
  isActive: boolean;
  slaHours?: number;
  autoApprove?: boolean;
};

type PoliciesPayload = { items: Policy[]; total: number };

export default async function Page() {
  await requirePagePermission(PERMISSIONS.dashboard);
  const data = await api.query<PoliciesPayload>('approvals/policies');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader title="Approval Policy Admin" description="Menaxho limitet, hapat dhe aktivizimin e approval rules pa ndryshim kodi." />
        <div className="flex gap-2">
          <Link href="/approvals/dashboard" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Dashboard</Link>
          <Link href="/approvals" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Inbox</Link>
        </div>
      </div>

      <PolicyAdminPanel policies={data.items} />
    </div>
  );
}
