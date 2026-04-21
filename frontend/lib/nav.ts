export const navSections = [
  {
    title: 'Ballina',
    items: [{ label: 'Pasqyra e Përgjithshme', href: '/dashboard' }],
  },
  {
    title: 'Të Dhëna Bazë',
    items: [
      { label: 'Rolet', href: '/roles' },
      { label: 'Përdoruesit', href: '/users' },
      { label: 'Kategoritë', href: '/item-categories' },
      { label: 'Njësitë', href: '/units' },
      { label: 'Normat e TVSH', href: '/tax-rates' },
      { label: 'Magazinat', href: '/warehouses' },
      { label: 'Metodat e Pagesës', href: '/payment-methods' },
      { label: 'Seritë e Dokumenteve', href: '/document-series' },
      { label: 'Artikujt', href: '/items' },
      { label: 'Furnitorët', href: '/suppliers' },
      { label: 'Klientët', href: '/customers' },
    ],
  },
  {
    title: 'Dokumentet',
    items: [
      { label: 'Faturat e Blerjes', href: '/purchase-invoices' },
      { label: 'Faturat e Shitjes', href: '/sales-invoices' },
      { label: 'Kthimet e Shitjes', href: '/sales-returns' },
    ],
  },
  {
    title: 'Stoku',
    items: [
      { label: 'Gjendja', href: '/stock/balances' },
      { label: 'Lëvizjet', href: '/stock/movements' },
    ],
  },
  {
    title: 'Sistemi',
    items: [{ label: 'Regjistri i Auditimit', href: '/audit-logs' }],
  },
];
