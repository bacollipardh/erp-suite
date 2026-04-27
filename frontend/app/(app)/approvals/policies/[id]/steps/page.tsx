import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { PolicyStepsPanel } from '@/components/approvals/policy-steps-panel';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type Policy = {
  id: string;
  code: string;
  name: string;
  entityType: string;
  action: string;
  requiredSteps: number;
};

type PolicyPayload = { items: Policy[]; total: number };
type StepsPayload = { items: any[]; total: number };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission(PERMISSIONS.dashboard);
  const { id } = await params;
  const [policies, steps] = await Promise.all([
    api.query<PolicyPayload>('approvals/policies'),
    api.query<StepsPayload>(`approvals/policies/${id}/steps`),
  ]);

  const policy = policies.items.find((item) => item.id === id);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="Approval Policy Steps"
          description={policy ? `${policy.code} · ${policy.name} · ${policy.entityType}/${policy.action}` : 'Konfigurimi i hapave te aprovimit.'}
        />
        <Link href="/approvals/policies" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back to Policies</Link>
      </div>

      <PolicyStepsPanel policyId={id} steps={steps.items} />
    </div>
  );
}
