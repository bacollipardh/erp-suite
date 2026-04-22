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

export function hasPermission(
  permissions: string[] | undefined | null,
  permission?: string | string[],
) {
  if (!permission) return true;
  if (Array.isArray(permission)) {
    return permission.some((entry) => (permissions ?? []).includes(entry));
  }
  return (permissions ?? []).includes(permission);
}
