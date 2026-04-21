import { api } from '@/lib/api';
import { CompanyProfileForm } from '@/components/company/company-profile-form';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function CompanyProfilePage() {
  await requirePagePermission(PERMISSIONS.companyProfileManage);
  let profile: any = null;
  try {
    profile = await api.getOne('company-profile');
  } catch {
    // No profile yet — form will create one
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Profili i Kompanisë</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Informacioni i biznesit tuaj — shfaqet në të gjitha faturat PDF.
        </p>
      </div>
      <CompanyProfileForm profile={profile} />
    </div>
  );
}
