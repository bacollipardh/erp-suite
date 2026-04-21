import { api } from '@/lib/api';
import { ReportsClient } from '@/components/reports/reports-client';

export default async function ReportsPage() {
  const [customers, users] = await Promise.all([
    api.list('customers', { limit: 100 }),
    api.list('users', { limit: 100 }),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Raportet</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Shitjet, arkëtimet dhe detyrimet me logjike server-side.
        </p>
      </div>
      <ReportsClient customers={customers} users={users} />
    </div>
  );
}
