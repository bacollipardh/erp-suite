import {
  LedgerAccountCategory,
  LedgerAccountReportSection,
} from '@prisma/client';

export const SYSTEM_LEDGER_ACCOUNT_CODES = {
  accountsReceivable: 'AR_TRADE',
  accountsPayable: 'AP_TRADE',
  inventory: 'INVENTORY',
  vatInput: 'VAT_INPUT',
  vatOutput: 'VAT_OUTPUT',
  salesRevenue: 'SALES_REVENUE',
  salesReturns: 'SALES_RETURNS',
  costOfSales: 'COST_OF_SALES',
  customerAdvances: 'CUSTOMER_ADVANCES',
  supplierAdvances: 'SUPPLIER_ADVANCES',
  openingEquity: 'OPENING_EQUITY',
  otherIncome: 'OTHER_INCOME',
  otherExpense: 'OTHER_EXPENSE',
  inventoryGain: 'INVENTORY_GAIN',
  inventoryLoss: 'INVENTORY_LOSS',
} as const;

export const SYSTEM_LEDGER_ACCOUNTS: Array<{
  code: string;
  name: string;
  category: LedgerAccountCategory;
  reportSection: LedgerAccountReportSection;
  sortOrder: number;
  description: string;
}> = [
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.accountsReceivable,
    name: 'Llogari te Arketueshme',
    category: LedgerAccountCategory.ASSET,
    reportSection: LedgerAccountReportSection.CURRENT_ASSET,
    sortOrder: 1100,
    description: 'Konto kontrolli per klientet dhe faturat e shitjes.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.supplierAdvances,
    name: 'Parapagime ndaj Furnitoreve',
    category: LedgerAccountCategory.ASSET,
    reportSection: LedgerAccountReportSection.CURRENT_ASSET,
    sortOrder: 1150,
    description: 'Parapagimet dhe tepricat ndaj furnitoreve.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.inventory,
    name: 'Inventari',
    category: LedgerAccountCategory.ASSET,
    reportSection: LedgerAccountReportSection.CURRENT_ASSET,
    sortOrder: 1200,
    description: 'Vlera kontabel e inventarit.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.vatInput,
    name: 'TVSH e Zbritshme',
    category: LedgerAccountCategory.ASSET,
    reportSection: LedgerAccountReportSection.CURRENT_ASSET,
    sortOrder: 1300,
    description: 'TVSH hyrse e zbritshme nga blerjet.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.accountsPayable,
    name: 'Llogari te Pagueshme',
    category: LedgerAccountCategory.LIABILITY,
    reportSection: LedgerAccountReportSection.CURRENT_LIABILITY,
    sortOrder: 2100,
    description: 'Konto kontrolli per furnitoret dhe faturat e blerjes.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.customerAdvances,
    name: 'Avanse nga Klientet',
    category: LedgerAccountCategory.LIABILITY,
    reportSection: LedgerAccountReportSection.CURRENT_LIABILITY,
    sortOrder: 2150,
    description: 'Parapagime dhe teprica te marra nga klientet.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.vatOutput,
    name: 'TVSH e Daljes',
    category: LedgerAccountCategory.LIABILITY,
    reportSection: LedgerAccountReportSection.CURRENT_LIABILITY,
    sortOrder: 2200,
    description: 'TVSH dalese nga shitjet.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.openingEquity,
    name: 'Kapitali Fillestar',
    category: LedgerAccountCategory.EQUITY,
    reportSection: LedgerAccountReportSection.EQUITY,
    sortOrder: 3000,
    description: 'Konto e balancave hapese dhe kapitalit fillestar.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.salesRevenue,
    name: 'Te Ardhura nga Shitja',
    category: LedgerAccountCategory.REVENUE,
    reportSection: LedgerAccountReportSection.REVENUE,
    sortOrder: 4000,
    description: 'Te ardhurat neto nga faturat e shitjes.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.salesReturns,
    name: 'Kthime nga Shitja',
    category: LedgerAccountCategory.CONTRA_REVENUE,
    reportSection: LedgerAccountReportSection.CONTRA_REVENUE,
    sortOrder: 4100,
    description: 'Konto kunder te ardhurave per credit notes dhe kthime.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.costOfSales,
    name: 'Kosto e Mallit te Shitur',
    category: LedgerAccountCategory.EXPENSE,
    reportSection: LedgerAccountReportSection.COST_OF_SALES,
    sortOrder: 5000,
    description: 'COGS per shitjet e postuara.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.inventoryLoss,
    name: 'Humbje nga Inventari',
    category: LedgerAccountCategory.EXPENSE,
    reportSection: LedgerAccountReportSection.OPERATING_EXPENSE,
    sortOrder: 6100,
    description: 'Humbje nga inventari, adjustime negative dhe count-out.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.otherExpense,
    name: 'Shpenzime te Tjera Operative',
    category: LedgerAccountCategory.EXPENSE,
    reportSection: LedgerAccountReportSection.OTHER_EXPENSE,
    sortOrder: 6900,
    description: 'Konto default per pagesa manuale dalese.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.inventoryGain,
    name: 'Fitime nga Inventari',
    category: LedgerAccountCategory.REVENUE,
    reportSection: LedgerAccountReportSection.OTHER_INCOME,
    sortOrder: 7100,
    description: 'Fitime nga inventari, adjustime pozitive dhe count-in.',
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.otherIncome,
    name: 'Te Ardhura te Tjera Operative',
    category: LedgerAccountCategory.REVENUE,
    reportSection: LedgerAccountReportSection.OTHER_INCOME,
    sortOrder: 7900,
    description: 'Konto default per hyrje manuale financiare.',
  },
];
