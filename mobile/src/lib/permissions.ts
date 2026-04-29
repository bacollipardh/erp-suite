export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
};

export const PERMISSIONS = {
  dashboard: 'dashboard:read',
  agentOrdersRead: 'agent-orders:read',
  agentOrdersManage: 'agent-orders:manage',
  agentOrdersAssign: 'agent-orders:assign',
  reportsReceivables: 'reports:receivables',
  wmsRead: 'wms:read',
  wmsManage: 'wms:manage',
  wmsPick: 'wms:pick',
  salesInvoicesManage: 'sales-invoices:manage',
  salesReturnsManage: 'sales-returns:manage',
  auditLogsRead: 'audit-logs:read',
} as const;

export function hasPermission(
  user: SessionUser | null | undefined,
  permission: string,
) {
  return Boolean(user?.permissions?.includes(permission));
}

export function canUseAgentApp(user: SessionUser | null | undefined) {
  return hasPermission(user, PERMISSIONS.agentOrdersRead);
}

export function canUsePickerApp(user: SessionUser | null | undefined) {
  return hasPermission(user, PERMISSIONS.wmsRead);
}

export function resolveHomePath(user: SessionUser | null | undefined) {
  if (!user) return '/login';
  if (user.role === 'SALES' && canUseAgentApp(user)) return '/agent';
  if (user.role === 'WMS' && canUsePickerApp(user)) return '/picker';
  return '/home';
}
