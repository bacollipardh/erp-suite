import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Login — ERP' };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border shadow-sm w-full max-w-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">bp ERP System</h1>
          <p className="text-sm text-slate-500 mt-1">Kyçu në llogarinë tuaj</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-xs text-slate-400 text-center">bp Enterprise ERP</p>
      </div>
    </div>
  );
}
