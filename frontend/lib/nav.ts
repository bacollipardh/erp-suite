import { PERMISSIONS } from './permissions';

export type NavSection = {
  title: string;
  iconPath: string;
  defaultOpen?: boolean;
  items: { label: string; href: string; permission?: string }[];
};

export const navSections: NavSection[] = [
  {
    title: 'Agjenti i Shitjes',
    iconPath:
      'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
    defaultOpen: true,
    items: [
      { label: 'Pika e Shitjes', href: '/agjenti-shitjes', permission: PERMISSIONS.salesInvoicesManage },
      { label: 'Historiku', href: '/agjenti-shitjes/historiku', permission: PERMISSIONS.salesInvoicesRead },
    ],
  },
  {
    title: 'Ballina',
    iconPath:
      'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
    defaultOpen: true,
    items: [{ label: 'Pasqyra e Pergjithshme', href: '/dashboard', permission: PERMISSIONS.dashboard }],
  },
  {
    title: 'Te Dhena Baze',
    iconPath:
      'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
    defaultOpen: false,
    items: [
      { label: 'Rolet', href: '/roles', permission: PERMISSIONS.rolesRead },
      { label: 'Perdoruesit', href: '/users', permission: PERMISSIONS.usersRead },
      { label: 'Kategorite', href: '/item-categories', permission: PERMISSIONS.itemCategoriesRead },
      { label: 'Njesite', href: '/units', permission: PERMISSIONS.unitsRead },
      { label: 'Normat e TVSH', href: '/tax-rates', permission: PERMISSIONS.taxRatesRead },
      { label: 'Magazinat', href: '/warehouses', permission: PERMISSIONS.warehousesRead },
      { label: 'Metodat e Pageses', href: '/payment-methods', permission: PERMISSIONS.paymentMethodsRead },
      { label: 'Serite e Dokumenteve', href: '/document-series', permission: PERMISSIONS.documentSeriesRead },
      { label: 'Artikujt', href: '/items', permission: PERMISSIONS.itemsRead },
      { label: 'Furnitoret', href: '/suppliers', permission: PERMISSIONS.suppliersRead },
      { label: 'Klientet', href: '/customers', permission: PERMISSIONS.customersRead },
    ],
  },
  {
    title: 'Financat',
    iconPath:
      'M2.25 18.75a60.07 60.07 0 0115.797-2.104c1.275 0 2.544.104 3.797.306M16.5 6.75h-9m9 4.5h-9m12 8.25H6.75A2.25 2.25 0 014.5 17.25V6.108c0-1.135.845-2.098 1.973-2.224a48.424 48.424 0 016.054-.384c2.17 0 4.338.128 6.495.384A2.25 2.25 0 0121 6.108V17.25a2.25 2.25 0 01-2.25 2.25z',
    defaultOpen: true,
    items: [
      { label: 'Arketimet', href: '/arketime', permission: PERMISSIONS.reportsReceivables },
      { label: 'Pagesat', href: '/pagesat', permission: PERMISSIONS.reportsPayables },
    ],
  },
  {
    title: 'Raportet',
    iconPath:
      'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    defaultOpen: true,
    items: [{ label: 'Raporti i Shitjeve', href: '/raportet', permission: PERMISSIONS.reportsSales }],
  },
  {
    title: 'Dokumentet',
    iconPath:
      'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
    defaultOpen: true,
    items: [
      { label: 'Faturat e Blerjes', href: '/purchase-invoices', permission: PERMISSIONS.purchaseInvoicesRead },
      { label: 'Faturat e Shitjes', href: '/sales-invoices', permission: PERMISSIONS.salesInvoicesRead },
      { label: 'Kthimet e Shitjes', href: '/sales-returns', permission: PERMISSIONS.salesReturnsRead },
    ],
  },
  {
    title: 'Stoku',
    iconPath:
      'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
    defaultOpen: true,
    items: [
      { label: 'Gjendja', href: '/stock/balances', permission: PERMISSIONS.stockRead },
      { label: 'Levizjet', href: '/stock/movements', permission: PERMISSIONS.stockRead },
      { label: 'Operacione', href: '/stock/operations', permission: PERMISSIONS.stockAdjust },
    ],
  },
  {
    title: 'Sistemi',
    iconPath:
      'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    defaultOpen: false,
    items: [
      { label: 'Profili i Kompanise', href: '/kompania', permission: PERMISSIONS.companyProfileManage },
      { label: 'Regjistri i Auditimit', href: '/audit-logs', permission: PERMISSIONS.auditLogsRead },
    ],
  },
];
