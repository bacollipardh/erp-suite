import { PERMISSIONS } from './permissions';

export type NavSection = {
  title: string;
  iconPath: string;
  defaultOpen?: boolean;
  items: { label: string; href: string; permission?: string | string[] }[];
};

export const navSections: NavSection[] = [
  {
    title: 'Ballina',
    iconPath:
      'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
    defaultOpen: true,
    items: [{ label: 'Pasqyra e Pergjithshme', href: '/dashboard', permission: PERMISSIONS.dashboard }],
  },
  {
    title: 'Shitja',
    iconPath:
      'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
    defaultOpen: true,
    items: [
      {
        label: 'Qendra e Shitjes',
        href: '/shitja',
        permission: [
          PERMISSIONS.customersRead,
          PERMISSIONS.salesInvoicesRead,
          PERMISSIONS.salesInvoicesManage,
          PERMISSIONS.salesReturnsRead,
          PERMISSIONS.reportsSales,
        ],
      },
      { label: 'Pika e Shitjes', href: '/agjenti-shitjes', permission: PERMISSIONS.salesInvoicesManage },
      { label: 'Historiku POS', href: '/agjenti-shitjes/historiku', permission: PERMISSIONS.salesInvoicesRead },
      { label: 'Klientet', href: '/customers', permission: PERMISSIONS.customersRead },
      { label: 'Faturat e Shitjes', href: '/sales-invoices', permission: PERMISSIONS.salesInvoicesRead },
      { label: 'Kthimet e Shitjes', href: '/sales-returns', permission: PERMISSIONS.salesReturnsRead },
    ],
  },
  {
    title: 'Blerja',
    iconPath:
      'M3 3.75A.75.75 0 013.75 3h10.5a.75.75 0 01.75.75V6h2.25a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V16.5H3.75A.75.75 0 013 15.75v-12zM6 16.5v2.25c0 .414.336.75.75.75h10.5a.75.75 0 00.75-.75V8.25a.75.75 0 00-.75-.75H15v8.25A.75.75 0 0114.25 16.5H6z',
    defaultOpen: true,
    items: [
      {
        label: 'Qendra e Blerjes',
        href: '/blerja',
        permission: [
          PERMISSIONS.suppliersRead,
          PERMISSIONS.purchaseInvoicesRead,
          PERMISSIONS.purchaseInvoicesManage,
        ],
      },
      { label: 'Furnitoret', href: '/suppliers', permission: PERMISSIONS.suppliersRead },
      { label: 'Faturat e Blerjes', href: '/purchase-invoices', permission: PERMISSIONS.purchaseInvoicesRead },
    ],
  },
  {
    title: 'Financa',
    iconPath:
      'M2.25 18.75a60.07 60.07 0 0115.797-2.104c1.275 0 2.544.104 3.797.306M16.5 6.75h-9m9 4.5h-9m12 8.25H6.75A2.25 2.25 0 014.5 17.25V6.108c0-1.135.845-2.098 1.973-2.224a48.424 48.424 0 016.054-.384c2.17 0 4.338.128 6.495.384A2.25 2.25 0 0121 6.108V17.25a2.25 2.25 0 01-2.25 2.25z',
    defaultOpen: true,
    items: [
      {
        label: 'Qendra e Financave',
        href: '/financa',
        permission: [
          PERMISSIONS.reportsReceivables,
          PERMISSIONS.reportsPayables,
          PERMISSIONS.salesInvoicesPay,
          PERMISSIONS.purchaseInvoicesPay,
          PERMISSIONS.financeAccountsRead,
        ],
      },
      {
        label: 'Llogarite Cash / Bank',
        href: '/financa/llogarite',
        permission: PERMISSIONS.financeAccountsRead,
      },
      {
        label: 'Dokumente Arketimi',
        href: '/financa/dokumente-arketimi',
        permission: PERMISSIONS.salesInvoicesPay,
      },
      {
        label: 'Dokumente Pagesash',
        href: '/financa/dokumente-pagesash',
        permission: PERMISSIONS.purchaseInvoicesPay,
      },
      {
        label: 'Periudhat Financiare',
        href: '/financa/periudhat',
        permission: PERMISSIONS.financialPeriodsRead,
      },
      {
        label: 'Libri Kontabel',
        href: '/financa/libri-kontabel',
        permission: PERMISSIONS.accountingRead,
      },
      {
        label: 'Journal Entry Manuale',
        href: '/financa/libri-kontabel/new',
        permission: PERMISSIONS.accountingManage,
      },
      {
        label: 'Mbyllja Kontabel',
        href: '/financa/mbyllja-kontabel',
        permission: PERMISSIONS.accountingManage,
      },
      {
        label: 'TVSH & Taksat',
        href: '/financa/tvsh',
        permission: PERMISSIONS.accountingRead,
      },
      {
        label: 'Deklarata Mujore e TVSH-se',
        href: '/financa/deklarata-tvsh',
        permission: PERMISSIONS.accountingRead,
      },
      {
        label: 'Pajtimi Bankar',
        href: '/financa/pajtimi-bankar',
        permission: PERMISSIONS.financeAccountsRead,
      },
      { label: 'Arketimet', href: '/arketime', permission: PERMISSIONS.reportsReceivables },
      {
        label: 'Rialokimi i Arketimeve',
        href: '/arketime/rialokime',
        permission: PERMISSIONS.salesInvoicesPay,
      },
      { label: 'Pagesat', href: '/pagesat', permission: PERMISSIONS.reportsPayables },
      {
        label: 'Rialokimi i Pagesave',
        href: '/pagesat/rialokime',
        permission: PERMISSIONS.purchaseInvoicesPay,
      },
    ],
  },
  {
    title: 'Artikuj & Stoku',
    iconPath:
      'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
    defaultOpen: true,
    items: [
      {
        label: 'Qendra e Stokut',
        href: '/stoku',
        permission: [
          PERMISSIONS.itemsRead,
          PERMISSIONS.warehousesRead,
          PERMISSIONS.stockRead,
          PERMISSIONS.stockAdjust,
        ],
      },
      { label: 'Artikujt', href: '/items', permission: PERMISSIONS.itemsRead },
      { label: 'Kategorite', href: '/item-categories', permission: PERMISSIONS.itemCategoriesRead },
      { label: 'Njesite', href: '/units', permission: PERMISSIONS.unitsRead },
      { label: 'Magazinat', href: '/warehouses', permission: PERMISSIONS.warehousesRead },
      { label: 'Gjendja e Stokut', href: '/stock/balances', permission: PERMISSIONS.stockRead },
      { label: 'Levizjet e Stokut', href: '/stock/movements', permission: PERMISSIONS.stockRead },
      { label: 'Operacione Stoku', href: '/stock/operations', permission: PERMISSIONS.stockAdjust },
    ],
  },
  {
    title: 'Raportet',
    iconPath:
      'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    defaultOpen: true,
    items: [
      {
        label: 'Qendra e Raporteve',
        href: '/raportet',
        permission: [
          PERMISSIONS.reportsSales,
          PERMISSIONS.reportsReceivables,
          PERMISSIONS.reportsPayables,
          PERMISSIONS.reportsAccounting,
          PERMISSIONS.stockRead,
        ],
      },
      { label: 'Raportet e Shitjes', href: '/raportet/shitje', permission: PERMISSIONS.reportsSales },
      {
        label: 'Raportet Financiare',
        href: '/raportet/financa',
        permission: [PERMISSIONS.reportsReceivables, PERMISSIONS.reportsPayables],
      },
      {
        label: 'Raportet Kontabel',
        href: '/raportet/kontabiliteti',
        permission: PERMISSIONS.reportsAccounting,
      },
      { label: 'Raportet e Stokut', href: '/raportet/stoku', permission: PERMISSIONS.stockRead },
    ],
  },
  {
    title: 'Administrim',
    iconPath:
      'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    defaultOpen: false,
    items: [
      { label: 'Rolet', href: '/roles', permission: PERMISSIONS.rolesRead },
      { label: 'Perdoruesit', href: '/users', permission: PERMISSIONS.usersRead },
      { label: 'Normat e TVSH', href: '/tax-rates', permission: PERMISSIONS.taxRatesRead },
      { label: 'Metodat e Pageses', href: '/payment-methods', permission: PERMISSIONS.paymentMethodsRead },
      { label: 'Serite e Dokumenteve', href: '/document-series', permission: PERMISSIONS.documentSeriesRead },
      { label: 'Profili i Kompanise', href: '/kompania', permission: PERMISSIONS.companyProfileManage },
      { label: 'Regjistri i Auditimit', href: '/audit-logs', permission: PERMISSIONS.auditLogsRead },
    ],
  },
];
