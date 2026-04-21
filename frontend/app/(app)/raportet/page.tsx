import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';
import { ReportsClient } from '@/components/reports/reports-client';

export default async function ReportsPage() {
  const user = await requireAnyPagePermission([
    PERMISSIONS.reportsSales,
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
  ]);

  const [customers, users] = await Promise.all([
    hasPermission(user.permissions, PERMISSIONS.reportsSales)
      ? api.list('customers', { limit: 100 })
      : Promise.resolve([]),
    hasPermission(user.permissions, PERMISSIONS.reportsSales) &&
    hasPermission(user.permissions, PERMISSIONS.usersRead)
      ? api.list('users', { limit: 100 })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Raportet</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Shitjet, arketimet dhe detyrimet me logjike server-side.
        </p>
      </div>
      <ReportsClient customers={customers} users={users} />
    </div>
  );
}
