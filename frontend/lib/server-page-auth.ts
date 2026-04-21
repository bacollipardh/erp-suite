import { redirect } from 'next/navigation';
import { api } from './api';
import { navSections } from './nav';
import { hasPermission } from './permissions';

type ServerSessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
  isActive?: boolean;
};

async function getCurrentServerUser(): Promise<ServerSessionUser | null> {
  try {
    return await api.fetch<ServerSessionUser>('/auth/me');
  } catch {
    return null;
  }
}

function getFallbackAuthorizedPath(permissions: string[] | undefined) {
  for (const section of navSections) {
    for (const item of section.items) {
      if (hasPermission(permissions, item.permission)) {
        return item.href;
      }
    }
  }

  return '/login';
}

export async function requirePagePermission(permission: string) {
  return requireAnyPagePermission([permission]);
}

export async function requireAnyPagePermission(permissions: string[]) {
  const user = await getCurrentServerUser();

  if (!user?.id || user.isActive === false) {
    redirect('/login');
  }

  if (!permissions.some((permission) => hasPermission(user.permissions, permission))) {
    redirect(getFallbackAuthorizedPath(user.permissions));
  }

  return user;
}
