export type ResourceField =
  | { name: string; label: string; type: 'text' | 'email' | 'textarea' | 'number' | 'checkbox' | 'date' }
  | {
      name: string;
      label: string;
      type: 'select';
      optionsEndpoint: string;
      valueKey?: string;
      labelKey?: string;
      labelTemplate?: string;
    };

export type ResourceConfig = {
  title: string;
  singular: string;
  description: string;
  endpoint: string;
  fields: ResourceField[];
  listColumns: { key: string; title: string; path?: string; renderType?: 'boolean' | 'status' }[];
};

export const resources: Record<string, ResourceConfig> = {
  roles: {
    title: 'Rolet',
    singular: 'Rol',
    description: 'Menaxhimi i roleve të sistemit.',
    endpoint: 'roles',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'name', label: 'Emri', type: 'text' },
      { name: 'isActive', label: 'Aktiv', type: 'checkbox' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'name', title: 'Emri' },
      { key: 'isActive', title: 'Aktiv', renderType: 'boolean' },
    ],
  },
  users: {
    title: 'Përdoruesit',
    singular: 'Përdorues',
    description: 'Menaxhimi i përdoruesve dhe caktimi i roleve.',
    endpoint: 'users',
    fields: [
      { name: 'roleId', label: 'Roli', type: 'select', optionsEndpoint: 'roles', labelKey: 'name' },
      { name: 'fullName', label: 'Emri i Plotë', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'password', label: 'Fjalëkalimi (lërë bosh për të mbajtur)', type: 'text' },
      { name: 'isActive', label: 'Aktiv', type: 'checkbox' },
    ],
    listColumns: [
      { key: 'fullName', title: 'Emri' },
      { key: 'email', title: 'Email' },
      { key: 'role.name', title: 'Roli' },
      { key: 'isActive', title: 'Aktiv', renderType: 'boolean' },
    ],
  },
  'item-categories': {
    title: 'Kategoritë',
    singular: 'Kategori',
    description: 'Menaxhimi i kategorive të artikujve.',
    endpoint: 'item-categories',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'name', label: 'Emri', type: 'text' },
      { name: 'parentId', label: 'Kategoria Prindërore', type: 'select', optionsEndpoint: 'item-categories', labelKey: 'name' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'name', title: 'Emri' },
      { key: 'parent.name', title: 'Prindi' },
    ],
  },
  units: {
    title: 'Njësitë',
    singular: 'Njësi',
    description: 'Menaxhimi i njësive të matjes.',
    endpoint: 'units',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'name', label: 'Emri', type: 'text' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'name', title: 'Emri' },
    ],
  },
  'tax-rates': {
    title: 'Normat e TVSH',
    singular: 'Normë TVSH',
    description: 'Normat e TVSH-së sipas legjislacionit të Kosovës.',
    endpoint: 'tax-rates',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'name', label: 'Emri', type: 'text' },
      { name: 'ratePercent', label: 'Norma %', type: 'number' },
      { name: 'isActive', label: 'Aktiv', type: 'checkbox' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'name', title: 'Emri' },
      { key: 'ratePercent', title: 'Norma %' },
      { key: 'isActive', title: 'Aktiv', renderType: 'boolean' },
    ],
  },
  warehouses: {
    title: 'Magazinat',
    singular: 'Magazinë',
    description: 'Menaxhimi i magazinave dhe lokacioneve.',
    endpoint: 'warehouses',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'name', label: 'Emri', type: 'text' },
      { name: 'address', label: 'Adresa', type: 'text' },
      { name: 'isActive', label: 'Aktiv', type: 'checkbox' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'name', title: 'Emri' },
      { key: 'address', title: 'Adresa' },
      { key: 'isActive', title: 'Aktiv', renderType: 'boolean' },
    ],
  },
  'payment-methods': {
    title: 'Metodat e Pagesës',
    singular: 'Metodë Pagese',
    description: 'Metodat e pagesës (kesh, bankë, kredi, etj).',
    endpoint: 'payment-methods',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'name', label: 'Emri', type: 'text' },
      { name: 'isActive', label: 'Aktiv', type: 'checkbox' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'name', title: 'Emri' },
      { key: 'isActive', title: 'Aktiv', renderType: 'boolean' },
    ],
  },
  'document-series': {
    title: 'Seritë e Dokumenteve',
    singular: 'Seri Dokumenti',
    description: 'Numërim për faturat e blerjes, shitjes dhe kthimeve.',
    endpoint: 'document-series',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'documentType', label: 'Tipi i Dokumentit', type: 'text' },
      { name: 'prefix', label: 'Parashtesa', type: 'text' },
      { name: 'nextNumber', label: 'Numri i Radhës', type: 'number' },
      { name: 'isActive', label: 'Aktiv', type: 'checkbox' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'documentType', title: 'Tipi' },
      { key: 'prefix', title: 'Parashtesa' },
      { key: 'nextNumber', title: 'Radhës' },
      { key: 'isActive', title: 'Aktiv', renderType: 'boolean' },
    ],
  },
  items: {
    title: 'Artikujt',
    singular: 'Artikull',
    description: 'Artikujt me kategori, njësi dhe normë TVSH.',
    endpoint: 'items',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'barcode', label: 'Barkodi', type: 'text' },
      { name: 'name', label: 'Emri', type: 'text' },
      { name: 'description', label: 'Përshkrimi', type: 'textarea' },
      { name: 'categoryId', label: 'Kategoria', type: 'select', optionsEndpoint: 'item-categories', labelKey: 'name' },
      { name: 'unitId', label: 'Njësia', type: 'select', optionsEndpoint: 'units', labelKey: 'name' },
      { name: 'taxRateId', label: 'Norma TVSH', type: 'select', optionsEndpoint: 'tax-rates', labelTemplate: 'name' },
      { name: 'standardPurchasePrice', label: 'Çmimi i Blerjes', type: 'number' },
      { name: 'standardSalesPrice', label: 'Çmimi i Shitjes', type: 'number' },
      { name: 'minSalesPrice', label: 'Çmimi Min. i Shitjes', type: 'number' },
      { name: 'isActive', label: 'Aktiv', type: 'checkbox' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'name', title: 'Emri' },
      { key: 'category.name', title: 'Kategoria' },
      { key: 'unit.name', title: 'Njësia' },
      { key: 'taxRate.name', title: 'TVSH' },
      { key: 'standardSalesPrice', title: 'Çmimi Shitjes' },
      { key: 'isActive', title: 'Aktiv', renderType: 'boolean' },
    ],
  },
  suppliers: {
    title: 'Furnitorët',
    singular: 'Furnitor',
    description: 'Menaxhimi i furnitorëve dhe kontekstit të blerjes.',
    endpoint: 'suppliers',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'name', label: 'Emri', type: 'text' },
      { name: 'fiscalNo', label: 'Numri Fiskal', type: 'text' },
      { name: 'vatNo', label: 'Numri TVSH', type: 'text' },
      { name: 'address', label: 'Adresa', type: 'text' },
      { name: 'city', label: 'Qyteti', type: 'text' },
      { name: 'phone', label: 'Telefoni', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'paymentTermsDays', label: 'Afati Pagesës (Ditë)', type: 'number' },
      { name: 'notes', label: 'Shënime', type: 'textarea' },
      { name: 'isActive', label: 'Aktiv', type: 'checkbox' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'name', title: 'Emri' },
      { key: 'fiscalNo', title: 'Nr. Fiskal' },
      { key: 'city', title: 'Qyteti' },
      { key: 'isActive', title: 'Aktiv', renderType: 'boolean' },
    ],
  },
  customers: {
    title: 'Klientët',
    singular: 'Klient',
    description: 'Menaxhimi i klientëve, kreditit dhe zbritjeve.',
    endpoint: 'customers',
    fields: [
      { name: 'code', label: 'Kodi', type: 'text' },
      { name: 'name', label: 'Emri', type: 'text' },
      { name: 'fiscalNo', label: 'Numri Fiskal', type: 'text' },
      { name: 'vatNo', label: 'Numri TVSH', type: 'text' },
      { name: 'address', label: 'Adresa', type: 'text' },
      { name: 'city', label: 'Qyteti', type: 'text' },
      { name: 'phone', label: 'Telefoni', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'creditLimit', label: 'Limiti i Kredisë', type: 'number' },
      { name: 'defaultDiscountPercent', label: 'Zbritja Standarde %', type: 'number' },
      { name: 'notes', label: 'Shënime', type: 'textarea' },
      { name: 'isActive', label: 'Aktiv', type: 'checkbox' },
    ],
    listColumns: [
      { key: 'code', title: 'Kodi' },
      { key: 'name', title: 'Emri' },
      { key: 'city', title: 'Qyteti' },
      { key: 'creditLimit', title: 'Limiti Kredisë' },
      { key: 'defaultDiscountPercent', title: 'Zbritja %' },
      { key: 'isActive', title: 'Aktiv', renderType: 'boolean' },
    ],
  },
};

export function getValueByPath(row: any, path: string) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), row);
}
