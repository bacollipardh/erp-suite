import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { ApprovalDecisionActions } from '@/components/approvals/approval-decision-actions';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type ApprovalDetail = {
  id: string;
  policyCode?: string | null;
  policyName?: string | null;
  entityType: string;
  entityNo?: string | null;
  action: string;
  title: string;
  description?: string | null;
  amount: number;
  currencyCode: string;
  status: string;
  requestedByName?: string | null;
  currentStep: number;
  requiredSteps: number;
  requestedAt: string;
  completedAt?: string | null;
  steps: { id: string; stepNo: number; status: string; decidedByName?: string | null; decisionNote?: string | null; decidedAt?: string | null }[];
  events: { id: string; action: string; note?: string | null; createdByName?: string | null; createdAt: string }[];
};

function money(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('sq-XK', { style: 'currency', currency }).format(Number(value ?? 0));
}

function statusClass(status: string) {
  if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'REJECTED') return 'bg-red-100 text-red-700 border-red-200';
  if (status === 'CANCELLED') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

function dt(value?: string | null) {
  return value ? new Date(value).toLocaleString('sq-XK') : '-';
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission(PERMISSIONS.dashboard);
  const { id } = await params;
  const data = await api.getOne<ApprovalDetail>(`approvals/requests/${id}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader title="Approval Detail" description="Historiku, hapat dhe vendimi për request-in e aprovimit." />
        <Link href="/approvals" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back to Inbox</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{data.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{data.description ?? '-'}</p>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(data.status)}`}>{data.status}</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Amount</div><div className="font-semibold">{money(data.amount, data.currencyCode)}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Entity</div><div className="font-semibold">{data.entityType}</div><div className="text-xs text-slate-400">{data.entityNo ?? '-'}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Action</div><div className="font-semibold">{data.action}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Step</div><div className="font-semibold">{data.currentStep} / {data.requiredSteps}</div></div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Policy</div><div className="font-semibold">{data.policyName ?? data.policyCode ?? '-'}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Requested By</div><div className="font-semibold">{data.requestedByName ?? '-'}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Requested At</div><div className="font-semibold">{dt(data.requestedAt)}</div></div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Approval Steps</h3>
            <div className="mt-4 space-y-2">
              {data.steps.map((step) => (
                <div key={step.id} className="rounded-xl border bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">Step {step.stepNo}</div>
                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(step.status)}`}>{step.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Decided by: {step.decidedByName ?? '-'} · {dt(step.decidedAt)}</div>
                  {step.decisionNote ? <div className="mt-2 text-sm text-slate-700">{step.decisionNote}</div> : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <ApprovalDecisionActions id={data.id} status={data.status} />
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Events</h3>
            <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-1">
              {data.events.map((event) => (
                <article key={event.id} className="rounded-xl border bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">{event.action}</div>
                  <div className="mt-1 text-xs text-slate-500">{dt(event.createdAt)} · {event.createdByName ?? '-'}</div>
                  {event.note ? <div className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{event.note}</div> : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
