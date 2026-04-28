import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { CreateApprovalRequestForm } from '@/components/approvals/create-approval-request-form';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewApprovalRequestPage() {
  await requirePagePermission(PERMISSIONS.dashboard);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title="New Approval Request"
          description="Krijo manualisht nje approval request pa e perzier me inbox-in."
        />
        <Link
          href="/approvals"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Kthehu te inbox
        </Link>
      </div>

      <CreateApprovalRequestForm defaultOpen />
    </div>
  );
}
