export const AUTH_COOKIE_NAME = 'erp_token';

export const ROLE_CODES = ['ADMIN', 'MANAGER', 'SALES', 'PURCHASE'] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSIONS = {
  dashboard: 'dashboard:read',
  reportsSales: 'reports:sales',
  reportsReceivables: 'reports:receivables',
  reportsPayables: 'reports:payables',
  rolesRead: 'roles:read',
  rolesManage: 'roles:manage',
  usersRead: 'users:read',
  usersManage: 'users:manage',
  itemCategoriesRead: 'item-categories:read',
  itemCategoriesManage: 'item-categories:manage',
  unitsRead: 'units:read',
  unitsManage: 'units:manage',
  taxRatesRead: 'tax-rates:read',
  taxRatesManage: 'tax-rates:manage',
  warehousesRead: 'warehouses:read',
  warehousesManage: 'warehouses:manage',
  paymentMethodsRead: 'payment-methods:read',
  paymentMethodsManage: 'payment-methods:manage',
  documentSeriesRead: 'document-series:read',
  documentSeriesManage: 'document-series:manage',
  itemsRead: 'items:read',
  itemsManage: 'items:manage',
  suppliersRead: 'suppliers:read',
  suppliersManage: 'suppliers:manage',
  customersRead: 'customers:read',
  customersManage: 'customers:manage',
  stockRead: 'stock:read',
  stockAdjust: 'stock:adjust',
  stockTransfer: 'stock:transfer',
  auditLogsRead: 'audit-logs:read',
  companyProfileRead: 'company-profile:read',
  companyProfileManage: 'company-profile:manage',
  purchaseInvoicesRead: 'purchase-invoices:read',
  purchaseInvoicesManage: 'purchase-invoices:manage',
  purchaseInvoicesPay: 'purchase-invoices:pay',
  salesInvoicesRead: 'sales-invoices:read',
  salesInvoicesManage: 'sales-invoices:manage',
  salesInvoicesPay: 'sales-invoices:pay',
  salesReturnsRead: 'sales-returns:read',
  salesReturnsManage: 'sales-returns:manage',
  pdfRead: 'pdf:read',
  fiscalize: 'fiscalization:submit',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const allPermissions = Object.values(PERMISSIONS);

export const ROLE_PERMISSION_MATRIX: Record<RoleCode, Permission[]> = {
  ADMIN: allPermissions,
  MANAGER: [
    PERMISSIONS.dashboard,
    PERMISSIONS.reportsSales,
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
    PERMISSIONS.usersRead,
    PERMISSIONS.itemCategoriesRead,
    PERMISSIONS.itemCategoriesManage,
    PERMISSIONS.unitsRead,
    PERMISSIONS.unitsManage,
    PERMISSIONS.taxRatesRead,
    PERMISSIONS.taxRatesManage,
    PERMISSIONS.warehousesRead,
    PERMISSIONS.warehousesManage,
    PERMISSIONS.paymentMethodsRead,
    PERMISSIONS.paymentMethodsManage,
    PERMISSIONS.documentSeriesRead,
    PERMISSIONS.documentSeriesManage,
    PERMISSIONS.itemsRead,
    PERMISSIONS.itemsManage,
    PERMISSIONS.suppliersRead,
    PERMISSIONS.suppliersManage,
    PERMISSIONS.customersRead,
    PERMISSIONS.customersManage,
    PERMISSIONS.stockRead,
    PERMISSIONS.stockAdjust,
    PERMISSIONS.stockTransfer,
    PERMISSIONS.auditLogsRead,
    PERMISSIONS.companyProfileRead,
    PERMISSIONS.companyProfileManage,
    PERMISSIONS.purchaseInvoicesRead,
    PERMISSIONS.purchaseInvoicesManage,
    PERMISSIONS.purchaseInvoicesPay,
    PERMISSIONS.salesInvoicesRead,
    PERMISSIONS.salesInvoicesManage,
    PERMISSIONS.salesInvoicesPay,
    PERMISSIONS.salesReturnsRead,
    PERMISSIONS.salesReturnsManage,
    PERMISSIONS.pdfRead,
    PERMISSIONS.fiscalize,
  ],
  SALES: [
    PERMISSIONS.dashboard,
    PERMISSIONS.reportsSales,
    PERMISSIONS.customersRead,
    PERMISSIONS.customersManage,
    PERMISSIONS.itemsRead,
    PERMISSIONS.warehousesRead,
    PERMISSIONS.paymentMethodsRead,
    PERMISSIONS.documentSeriesRead,
    PERMISSIONS.stockRead,
    PERMISSIONS.companyProfileRead,
    PERMISSIONS.salesInvoicesRead,
    PERMISSIONS.salesInvoicesManage,
    PERMISSIONS.salesInvoicesPay,
    PERMISSIONS.salesReturnsRead,
    PERMISSIONS.salesReturnsManage,
    PERMISSIONS.pdfRead,
    PERMISSIONS.fiscalize,
  ],
  PURCHASE: [
    PERMISSIONS.dashboard,
    PERMISSIONS.suppliersRead,
    PERMISSIONS.suppliersManage,
    PERMISSIONS.itemsRead,
    PERMISSIONS.itemCategoriesRead,
    PERMISSIONS.unitsRead,
    PERMISSIONS.taxRatesRead,
    PERMISSIONS.warehousesRead,
    PERMISSIONS.documentSeriesRead,
    PERMISSIONS.stockRead,
    PERMISSIONS.stockAdjust,
    PERMISSIONS.stockTransfer,
    PERMISSIONS.companyProfileRead,
    PERMISSIONS.purchaseInvoicesRead,
    PERMISSIONS.purchaseInvoicesManage,
    PERMISSIONS.purchaseInvoicesPay,
    PERMISSIONS.pdfRead,
  ],
};

export function getPermissionsForRole(role: string): Permission[] {
  if (!ROLE_CODES.includes(role as RoleCode)) return [];
  return ROLE_PERMISSION_MATRIX[role as RoleCode];
}

export function hasPermissions(role: string, required: Permission[]) {
  if (role === 'ADMIN') return true;
  const current = new Set(getPermissionsForRole(role));
  return required.every((permission) => current.has(permission));
}
