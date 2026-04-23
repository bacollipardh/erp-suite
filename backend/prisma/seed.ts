import {
  FinanceAccountTransactionType,
  FinanceAccountType,
  FiscalMode,
  JournalEntryLineSide,
  LedgerAccountCategory,
  LedgerAccountReportSection,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Admin123!';
const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const COMPANY_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const SEED_INVENTORY_OPENING_SOURCE_ID = '00000000-0000-0000-0000-0000000000a1';

const SYSTEM_LEDGER_ACCOUNT_CODES = {
  accountsReceivable: 'AR_TRADE',
  accountsPayable: 'AP_TRADE',
  prepaidExpenses: 'PREPAID_EXPENSES',
  inventory: 'INVENTORY',
  vatInput: 'VAT_INPUT',
  vatOutput: 'VAT_OUTPUT',
  accruedLiabilities: 'ACCRUED_LIABILITIES',
  salesRevenue: 'SALES_REVENUE',
  salesReturns: 'SALES_RETURNS',
  costOfSales: 'COST_OF_SALES',
  customerAdvances: 'CUSTOMER_ADVANCES',
  supplierAdvances: 'SUPPLIER_ADVANCES',
  openingEquity: 'OPENING_EQUITY',
  retainedEarnings: 'RETAINED_EARNINGS',
  otherIncome: 'OTHER_INCOME',
  otherExpense: 'OTHER_EXPENSE',
  inventoryGain: 'INVENTORY_GAIN',
  inventoryLoss: 'INVENTORY_LOSS',
} as const;

const SYSTEM_LEDGER_ACCOUNTS: Array<{
  code: string;
  name: string;
  category: LedgerAccountCategory;
  reportSection: LedgerAccountReportSection;
  sortOrder: number;
  description: string;
  allowManual?: boolean;
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
    code: SYSTEM_LEDGER_ACCOUNT_CODES.prepaidExpenses,
    name: 'Shpenzime te Parapaguar',
    category: LedgerAccountCategory.ASSET,
    reportSection: LedgerAccountReportSection.CURRENT_ASSET,
    sortOrder: 1175,
    description: 'Konto manuale per parapagime dhe deferrals te shpenzimeve.',
    allowManual: true,
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
    allowManual: true,
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
    code: SYSTEM_LEDGER_ACCOUNT_CODES.accruedLiabilities,
    name: 'Detyrime te Akumuluara',
    category: LedgerAccountCategory.LIABILITY,
    reportSection: LedgerAccountReportSection.CURRENT_LIABILITY,
    sortOrder: 2175,
    description: 'Konto manuale per accruals, detyrime te pambyllura dhe provizione operative.',
    allowManual: true,
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.vatOutput,
    name: 'TVSH e Daljes',
    category: LedgerAccountCategory.LIABILITY,
    reportSection: LedgerAccountReportSection.CURRENT_LIABILITY,
    sortOrder: 2200,
    description: 'TVSH dalese nga shitjet.',
    allowManual: true,
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
    code: SYSTEM_LEDGER_ACCOUNT_CODES.retainedEarnings,
    name: 'Fitim i Mbartur',
    category: LedgerAccountCategory.EQUITY,
    reportSection: LedgerAccountReportSection.EQUITY,
    sortOrder: 3100,
    description: 'Konto e mbylljes se periudhave dhe rezultatit te mbartur.',
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
    allowManual: true,
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.otherExpense,
    name: 'Shpenzime te Tjera Operative',
    category: LedgerAccountCategory.EXPENSE,
    reportSection: LedgerAccountReportSection.OTHER_EXPENSE,
    sortOrder: 6900,
    description: 'Konto default per pagesa manuale dalese.',
    allowManual: true,
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.inventoryGain,
    name: 'Fitime nga Inventari',
    category: LedgerAccountCategory.REVENUE,
    reportSection: LedgerAccountReportSection.OTHER_INCOME,
    sortOrder: 7100,
    description: 'Fitime nga inventari, adjustime pozitive dhe count-in.',
    allowManual: true,
  },
  {
    code: SYSTEM_LEDGER_ACCOUNT_CODES.otherIncome,
    name: 'Te Ardhura te Tjera Operative',
    category: LedgerAccountCategory.REVENUE,
    reportSection: LedgerAccountReportSection.OTHER_INCOME,
    sortOrder: 7900,
    description: 'Konto default per hyrje manuale financiare.',
    allowManual: true,
  },
];

function inferNextSeriesNumber(params: {
  prefix: string;
  currentNextNumber?: number | null;
  existingDocNos: string[];
}) {
  const highestDocNumber = params.existingDocNos.reduce((max, docNo) => {
    if (!docNo.startsWith(params.prefix)) {
      return max;
    }

    const numericPart = Number.parseInt(docNo.slice(params.prefix.length), 10);
    if (Number.isNaN(numericPart)) {
      return max;
    }

    return Math.max(max, numericPart);
  }, 0);

  return Math.max(params.currentNextNumber ?? 1, highestDocNumber + 1, 1);
}

function buildPeriodBounds(year: number, month: number) {
  return {
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    periodEnd: new Date(Date.UTC(year, month, 0)),
  };
}

async function ensureFinancialYear(year: number) {
  for (let month = 1; month <= 12; month += 1) {
    const { periodStart, periodEnd } = buildPeriodBounds(year, month);
    await prisma.financialPeriod.upsert({
      where: {
        year_month: {
          year,
          month,
        },
      },
      update: {
        periodStart,
        periodEnd,
      },
      create: {
        year,
        month,
        periodStart,
        periodEnd,
      },
    });
  }
}

async function upsertUser(params: {
  id: string;
  roleId: string;
  fullName: string;
  email: string;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { id: params.id },
    update: {
      roleId: params.roleId,
      fullName: params.fullName,
      email: params.email,
      passwordHash: params.passwordHash,
      isActive: true,
    },
    create: {
      ...params,
      isActive: true,
    },
  });
}

async function resolveSeriesDocNos(documentType: string, seriesId: string) {
  if (documentType === 'PURCHASE_INVOICE') {
    const docs = await prisma.purchaseInvoice.findMany({
      where: { seriesId },
      select: { docNo: true },
    });

    return docs.map((doc) => doc.docNo);
  }

  if (documentType === 'SALES_INVOICE') {
    const docs = await prisma.salesInvoice.findMany({
      where: { seriesId },
      select: { docNo: true },
    });

    return docs.map((doc) => doc.docNo);
  }

  if (documentType === 'SALES_RETURN') {
    const docs = await prisma.salesReturn.findMany({
      where: { seriesId },
      select: { docNo: true },
    });

    return docs.map((doc) => doc.docNo);
  }

  return [];
}

async function upsertDocumentSeries(params: {
  code: string;
  documentType: 'PURCHASE_INVOICE' | 'SALES_INVOICE' | 'SALES_RETURN';
  prefix: string;
}) {
  const existing = await prisma.documentSeries.findUnique({
    where: { code: params.code },
    select: { id: true, nextNumber: true },
  });

  const existingDocNos = existing
    ? await resolveSeriesDocNos(params.documentType, existing.id)
    : [];

  const nextNumber = inferNextSeriesNumber({
    prefix: params.prefix,
    currentNextNumber: existing?.nextNumber,
    existingDocNos,
  });

  return prisma.documentSeries.upsert({
    where: { code: params.code },
    update: {
      documentType: params.documentType,
      prefix: params.prefix,
      nextNumber,
      isActive: true,
    },
    create: {
      code: params.code,
      documentType: params.documentType,
      prefix: params.prefix,
      nextNumber,
      isActive: true,
    },
  });
}

async function upsertFinanceAccount(params: {
  code: string;
  name: string;
  accountType: FinanceAccountType;
  currencyCode?: string;
  bankName?: string | null;
  bankAccountNo?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
  openingBalance?: number;
  notes?: string | null;
}) {
  const existing = await prisma.financeAccount.findUnique({
    where: { code: params.code },
    select: {
      openingBalance: true,
      currentBalance: true,
    },
  });

  const openingBalance = Number(existing?.openingBalance ?? params.openingBalance ?? 0);
  const currentBalance = Number(existing?.currentBalance ?? openingBalance);

  return prisma.financeAccount.upsert({
    where: { code: params.code },
    update: {
      name: params.name,
      accountType: params.accountType,
      currencyCode: params.currencyCode ?? 'EUR',
      bankName: params.bankName ?? null,
      bankAccountNo: params.bankAccountNo ?? null,
      iban: params.iban ?? null,
      swiftCode: params.swiftCode ?? null,
      openingBalance,
      currentBalance,
      isActive: true,
      notes: params.notes ?? null,
    },
    create: {
      code: params.code,
      name: params.name,
      accountType: params.accountType,
      currencyCode: params.currencyCode ?? 'EUR',
      bankName: params.bankName ?? null,
      bankAccountNo: params.bankAccountNo ?? null,
      iban: params.iban ?? null,
      swiftCode: params.swiftCode ?? null,
      openingBalance,
      currentBalance,
      isActive: true,
      notes: params.notes ?? null,
    },
  });
}

async function ensureChartOfAccountsSeed() {
  for (const account of SYSTEM_LEDGER_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { code: account.code },
        update: {
          name: account.name,
          category: account.category,
          reportSection: account.reportSection,
          isSystem: true,
          isActive: true,
          allowManual: account.allowManual ?? false,
          sortOrder: account.sortOrder,
          description: account.description,
        },
        create: {
          code: account.code,
        name: account.name,
          category: account.category,
          reportSection: account.reportSection,
          isSystem: true,
          isActive: true,
          allowManual: account.allowManual ?? false,
          sortOrder: account.sortOrder,
          description: account.description,
        },
      });
  }

  const financeAccounts = await prisma.financeAccount.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      accountType: true,
      isActive: true,
      notes: true,
      ledgerAccountId: true,
    },
  });

  for (const account of financeAccounts) {
    const ledgerAccount = await prisma.ledgerAccount.upsert({
      where: { code: account.code },
      update: {
        name: account.name,
        category: LedgerAccountCategory.ASSET,
        reportSection: LedgerAccountReportSection.CURRENT_ASSET,
        isSystem: true,
        isActive: account.isActive,
        allowManual: false,
        sortOrder: account.accountType === FinanceAccountType.CASH ? 1010 : 1020,
        description: account.notes?.trim() || null,
      },
      create: {
        code: account.code,
        name: account.name,
        category: LedgerAccountCategory.ASSET,
        reportSection: LedgerAccountReportSection.CURRENT_ASSET,
        isSystem: true,
        isActive: account.isActive,
        allowManual: false,
        sortOrder: account.accountType === FinanceAccountType.CASH ? 1010 : 1020,
        description: account.notes?.trim() || null,
      },
    });

    if (account.ledgerAccountId !== ledgerAccount.id) {
      await prisma.financeAccount.update({
        where: { id: account.id },
        data: { ledgerAccountId: ledgerAccount.id },
      });
    }
  }
}

async function nextJournalEntryNo(entryDate: Date) {
  const year = entryDate.getUTCFullYear();
  const month = entryDate.getUTCMonth() + 1;
  const prefix = `JE-${year}${String(month).padStart(2, '0')}-`;
  const count = await prisma.journalEntry.count({
    where: { year, month },
  });

  return `${prefix}${String(count + 1).padStart(6, '0')}`;
}

async function upsertJournalEntryBySource(params: {
  entryDate: Date;
  description: string;
  sourceType: string;
  sourceId: string;
  sourceNo?: string | null;
  createdById: string;
  lines: Array<{
    accountId: string;
    lineNo: number;
    side: JournalEntryLineSide;
    amount: number;
    description?: string | null;
    partyName?: string | null;
  }>;
}) {
  const entryDate = new Date(
    Date.UTC(
      params.entryDate.getUTCFullYear(),
      params.entryDate.getUTCMonth(),
      params.entryDate.getUTCDate(),
    ),
  );
  const year = entryDate.getUTCFullYear();
  const month = entryDate.getUTCMonth() + 1;
  const existing = await prisma.journalEntry.findFirst({
    where: {
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    },
    select: { id: true },
  });

  const normalizedLines = params.lines
    .map((line) => ({
      ...line,
      amount: Number(line.amount ?? 0),
    }))
    .filter((line) => line.amount > 0);

  if (!normalizedLines.length) {
    return null;
  }

  if (existing) {
    await prisma.journalEntryLine.deleteMany({
      where: { journalEntryId: existing.id },
    });

    return prisma.journalEntry.update({
      where: { id: existing.id },
      data: {
        entryDate,
        year,
        month,
        description: params.description,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        sourceNo: params.sourceNo ?? null,
        createdById: params.createdById,
        lines: {
          createMany: {
            data: normalizedLines,
          },
        },
      },
    });
  }

  return prisma.journalEntry.create({
    data: {
      entryNo: await nextJournalEntryNo(entryDate),
      entryDate,
      year,
      month,
      description: params.description,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceNo: params.sourceNo ?? null,
      createdById: params.createdById,
      lines: {
        createMany: {
          data: normalizedLines,
        },
      },
    },
  });
}

async function seedOpeningLedgerBalances(createdById: string, entryDate: Date) {
  await ensureChartOfAccountsSeed();

  const openingEquity = await prisma.ledgerAccount.findUniqueOrThrow({
    where: { code: SYSTEM_LEDGER_ACCOUNT_CODES.openingEquity },
    select: { id: true },
  });
  const inventoryAccount = await prisma.ledgerAccount.findUniqueOrThrow({
    where: { code: SYSTEM_LEDGER_ACCOUNT_CODES.inventory },
    select: { id: true },
  });

  const financeAccounts = await prisma.financeAccount.findMany({
    where: {
      openingBalance: { not: 0 },
    },
    select: {
      id: true,
      code: true,
      name: true,
      openingBalance: true,
      ledgerAccountId: true,
    },
  });

  for (const account of financeAccounts) {
    if (!account.ledgerAccountId) {
      continue;
    }

    const referenceNo = `SEED-OPEN-${account.code}`;
    const existingOpening = await prisma.financeAccountTransaction.findFirst({
      where: {
        accountId: account.id,
        transactionType: FinanceAccountTransactionType.OPENING,
        referenceNo,
      },
      select: {
        id: true,
      },
    });

    const amount = Number(account.openingBalance ?? 0);
    let transactionId = existingOpening?.id ?? null;

    if (!transactionId) {
      const openingTransaction = await prisma.financeAccountTransaction.create({
        data: {
          accountId: account.id,
          transactionType: FinanceAccountTransactionType.OPENING,
          amount,
          balanceBefore: 0,
          balanceAfter: amount,
          transactionDate: entryDate,
          referenceNo,
          notes: 'Seed opening balance',
          createdById,
        },
        select: { id: true },
      });

      transactionId = openingTransaction.id;
    }

    await upsertJournalEntryBySource({
      entryDate,
      description: `Balanca hapese per ${account.name}`,
      sourceType: 'FINANCE_OPENING',
      sourceId: transactionId,
      sourceNo: referenceNo,
      createdById,
      lines: [
        {
          accountId: account.ledgerAccountId,
          lineNo: 1,
          side: JournalEntryLineSide.DEBIT,
          amount,
        },
        {
          accountId: openingEquity.id,
          lineNo: 2,
          side: JournalEntryLineSide.CREDIT,
          amount,
        },
      ],
    });
  }

  const stockBalances = await prisma.stockBalance.findMany({
    where: {
      qtyOnHand: { gt: 0 },
    },
    select: {
      qtyOnHand: true,
      avgCost: true,
    },
  });

  const inventoryOpeningValue = Number(
    stockBalances.reduce(
      (sum, row) => sum + Number(row.qtyOnHand ?? 0) * Number(row.avgCost ?? 0),
      0,
    ),
  );

  if (inventoryOpeningValue > 0) {
    await upsertJournalEntryBySource({
      entryDate,
      description: 'Balanca hapese e inventarit nga seed',
      sourceType: 'INVENTORY_OPENING',
      sourceId: SEED_INVENTORY_OPENING_SOURCE_ID,
      sourceNo: 'SEED-OPEN-INVENTORY',
      createdById,
      lines: [
        {
          accountId: inventoryAccount.id,
          lineNo: 1,
          side: JournalEntryLineSide.DEBIT,
          amount: inventoryOpeningValue,
        },
        {
          accountId: openingEquity.id,
          lineNo: 2,
          side: JournalEntryLineSide.CREDIT,
          amount: inventoryOpeningValue,
        },
      ],
    });
  }
}

async function main() {
  console.log('Seeding database...');
  const currentYear = new Date().getUTCFullYear();

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { name: 'Administrator', isActive: true },
    create: { code: 'ADMIN', name: 'Administrator', isActive: true },
  });

  const managerRole = await prisma.role.upsert({
    where: { code: 'MANAGER' },
    update: { name: 'Manager', isActive: true },
    create: { code: 'MANAGER', name: 'Manager', isActive: true },
  });

  const salesRole = await prisma.role.upsert({
    where: { code: 'SALES' },
    update: { name: 'Sales Operator', isActive: true },
    create: { code: 'SALES', name: 'Sales Operator', isActive: true },
  });

  const purchaseRole = await prisma.role.upsert({
    where: { code: 'PURCHASE' },
    update: { name: 'Purchase Operator', isActive: true },
    create: { code: 'PURCHASE', name: 'Purchase Operator', isActive: true },
  });

  const adminUser = await upsertUser({
    id: ADMIN_ID,
    roleId: adminRole.id,
    fullName: 'System Admin',
    email: 'admin@erp.local',
    passwordHash,
  });

  await prisma.user.upsert({
    where: { email: 'manager@erp.local' },
    update: {
      roleId: managerRole.id,
      fullName: 'General Manager',
      passwordHash,
      isActive: true,
    },
    create: {
      roleId: managerRole.id,
      fullName: 'General Manager',
      email: 'manager@erp.local',
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'sales@erp.local' },
    update: {
      roleId: salesRole.id,
      fullName: 'Sales Agent',
      passwordHash,
      isActive: true,
    },
    create: {
      roleId: salesRole.id,
      fullName: 'Sales Agent',
      email: 'sales@erp.local',
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'purchase@erp.local' },
    update: {
      roleId: purchaseRole.id,
      fullName: 'Purchase Officer',
      passwordHash,
      isActive: true,
    },
    create: {
      roleId: purchaseRole.id,
      fullName: 'Purchase Officer',
      email: 'purchase@erp.local',
      passwordHash,
      isActive: true,
    },
  });

  await prisma.companyProfile.upsert({
    where: { id: COMPANY_PROFILE_ID },
    update: {
      name: 'bp ERP Demo',
      fiscalNo: '810000001',
      vatNo: '330000001',
      businessNo: '810000001',
      address: 'Prishtine, Kosovo',
      city: 'Prishtine',
      phone: '+38344111222',
      email: 'info@bperp.local',
      website: 'https://bperp.local',
      bankName: 'Bank for Business',
      bankAccount: '210000000001',
      fiscalMode: FiscalMode.SANDBOX,
      fiscalBusinessUnit: 'MAIN',
      fiscalOperatorCode: 'OP-001',
      fiscalDeviceId: 'DEV-001',
    },
    create: {
      id: COMPANY_PROFILE_ID,
      name: 'bp ERP Demo',
      fiscalNo: '810000001',
      vatNo: '330000001',
      businessNo: '810000001',
      address: 'Prishtine, Kosovo',
      city: 'Prishtine',
      phone: '+38344111222',
      email: 'info@bperp.local',
      website: 'https://bperp.local',
      bankName: 'Bank for Business',
      bankAccount: '210000000001',
      fiscalMode: FiscalMode.SANDBOX,
      fiscalBusinessUnit: 'MAIN',
      fiscalOperatorCode: 'OP-001',
      fiscalDeviceId: 'DEV-001',
    },
  });

  const goodsCategory = await prisma.itemCategory.upsert({
    where: { code: 'GOODS' },
    update: { name: 'Goods' },
    create: { code: 'GOODS', name: 'Goods' },
  });

  const servicesCategory = await prisma.itemCategory.upsert({
    where: { code: 'SERVICES' },
    update: { name: 'Services' },
    create: { code: 'SERVICES', name: 'Services' },
  });

  await prisma.itemCategory.upsert({
    where: { code: 'ACCESSORIES' },
    update: { name: 'Accessories', parentId: goodsCategory.id },
    create: { code: 'ACCESSORIES', name: 'Accessories', parentId: goodsCategory.id },
  });

  const unitPiece = await prisma.unit.upsert({
    where: { code: 'COP' },
    update: { name: 'Cope' },
    create: { code: 'COP', name: 'Cope' },
  });

  const unitKg = await prisma.unit.upsert({
    where: { code: 'KG' },
    update: { name: 'Kilogram' },
    create: { code: 'KG', name: 'Kilogram' },
  });

  await prisma.unit.upsert({
    where: { code: 'L' },
    update: { name: 'Liter' },
    create: { code: 'L', name: 'Liter' },
  });

  const tax18 = await prisma.taxRate.upsert({
    where: { code: 'VAT18' },
    update: { name: 'VAT 18%', ratePercent: 18, isActive: true },
    create: { code: 'VAT18', name: 'VAT 18%', ratePercent: 18, isActive: true },
  });

  await prisma.taxRate.upsert({
    where: { code: 'VAT8' },
    update: { name: 'VAT 8%', ratePercent: 8, isActive: true },
    create: { code: 'VAT8', name: 'VAT 8%', ratePercent: 8, isActive: true },
  });

  await prisma.taxRate.upsert({
    where: { code: 'VAT0' },
    update: { name: 'VAT 0%', ratePercent: 0, isActive: true },
    create: { code: 'VAT0', name: 'VAT 0%', ratePercent: 0, isActive: true },
  });

  const mainWarehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN' },
    update: { name: 'Main Warehouse', address: 'Prishtine, Kosovo', isActive: true },
    create: { code: 'MAIN', name: 'Main Warehouse', address: 'Prishtine, Kosovo', isActive: true },
  });

  await prisma.warehouse.upsert({
    where: { code: 'SECONDARY' },
    update: { name: 'Secondary Warehouse', address: 'Prizren, Kosovo', isActive: true },
    create: { code: 'SECONDARY', name: 'Secondary Warehouse', address: 'Prizren, Kosovo', isActive: true },
  });

  await prisma.paymentMethod.upsert({
    where: { code: 'CASH' },
    update: { name: 'Cash', isActive: true },
    create: { code: 'CASH', name: 'Cash', isActive: true },
  });

  await prisma.paymentMethod.upsert({
    where: { code: 'BANK' },
    update: { name: 'Bank Transfer', isActive: true },
    create: { code: 'BANK', name: 'Bank Transfer', isActive: true },
  });

  await prisma.paymentMethod.upsert({
    where: { code: 'CREDIT' },
    update: { name: 'Credit / Card', isActive: true },
    create: { code: 'CREDIT', name: 'Credit / Card', isActive: true },
  });

  await upsertFinanceAccount({
    code: 'CASH_MAIN',
    name: 'Main Cash Desk',
    accountType: FinanceAccountType.CASH,
    openingBalance: 1500,
    notes: 'Kasa kryesore per arketime dhe pagesa ditore.',
  });

  await upsertFinanceAccount({
    code: 'BANK_MAIN',
    name: 'Primary Bank Account',
    accountType: FinanceAccountType.BANK,
    bankName: 'Bank for Business',
    bankAccountNo: '210000000001',
    iban: 'XK051212012345678906',
    swiftCode: 'BPBUSXK1',
    openingBalance: 5000,
    notes: 'Llogaria bankare kryesore e kompanise.',
  });

  await upsertDocumentSeries({
    code: 'FB',
    documentType: 'PURCHASE_INVOICE',
    prefix: 'FB-',
  });

  await upsertDocumentSeries({
    code: 'FS',
    documentType: 'SALES_INVOICE',
    prefix: 'FS-',
  });

  await upsertDocumentSeries({
    code: 'KS',
    documentType: 'SALES_RETURN',
    prefix: 'KS-',
  });

  await ensureFinancialYear(currentYear - 1);
  await ensureFinancialYear(currentYear);
  await ensureFinancialYear(currentYear + 1);

  await prisma.item.upsert({
    where: { code: 'LAPTOP-001' },
    update: {
      name: 'Laptop Pro 15',
      categoryId: goodsCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 800,
      standardSalesPrice: 1100,
      minSalesPrice: 900,
      isActive: true,
    },
    create: {
      code: 'LAPTOP-001',
      name: 'Laptop Pro 15',
      description: 'Business laptop',
      categoryId: goodsCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 800,
      standardSalesPrice: 1100,
      minSalesPrice: 900,
      isActive: true,
    },
  });

  await prisma.item.upsert({
    where: { code: 'MONITOR-001' },
    update: {
      name: 'Monitor 24',
      categoryId: goodsCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 200,
      standardSalesPrice: 280,
      isActive: true,
    },
    create: {
      code: 'MONITOR-001',
      name: 'Monitor 24',
      categoryId: goodsCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 200,
      standardSalesPrice: 280,
      isActive: true,
    },
  });

  await prisma.item.upsert({
    where: { code: 'CONSULT-001' },
    update: {
      name: 'IT Consulting',
      categoryId: servicesCategory.id,
      unitId: unitKg.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 0,
      standardSalesPrice: 65,
      isActive: true,
    },
    create: {
      code: 'CONSULT-001',
      name: 'IT Consulting',
      categoryId: servicesCategory.id,
      unitId: unitKg.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 0,
      standardSalesPrice: 65,
      isActive: true,
    },
  });

  await prisma.supplier.upsert({
    where: { code: 'SUP-001' },
    update: {
      name: 'Tech Distributors Shpk',
      fiscalNo: '70012345',
      vatNo: '331012345',
      address: 'Prishtine',
      city: 'Prishtine',
      phone: '+38344123456',
      email: 'info@techdist.ks',
      paymentTermsDays: 30,
      isActive: true,
    },
    create: {
      code: 'SUP-001',
      name: 'Tech Distributors Shpk',
      fiscalNo: '70012345',
      vatNo: '331012345',
      address: 'Prishtine',
      city: 'Prishtine',
      phone: '+38344123456',
      email: 'info@techdist.ks',
      paymentTermsDays: 30,
      isActive: true,
    },
  });

  await prisma.customer.upsert({
    where: { code: 'CUS-001' },
    update: {
      name: 'Kompania ABC Shpk',
      fiscalNo: '70055555',
      vatNo: '331055555',
      address: 'Prishtine',
      city: 'Prishtine',
      phone: '+38344555666',
      email: 'contact@abc.ks',
      creditLimit: 5000,
      defaultDiscountPercent: 2,
      isActive: true,
    },
    create: {
      code: 'CUS-001',
      name: 'Kompania ABC Shpk',
      fiscalNo: '70055555',
      vatNo: '331055555',
      address: 'Prishtine',
      city: 'Prishtine',
      phone: '+38344555666',
      email: 'contact@abc.ks',
      creditLimit: 5000,
      defaultDiscountPercent: 2,
      isActive: true,
    },
  });

  await prisma.customer.upsert({
    where: { code: 'CUS-002' },
    update: {
      name: 'Biznesi XYZ',
      city: 'Ferizaj',
      isActive: true,
    },
    create: {
      code: 'CUS-002',
      name: 'Biznesi XYZ',
      city: 'Ferizaj',
      isActive: true,
    },
  });

  await prisma.stockBalance.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: mainWarehouse.id,
        itemId: (
          await prisma.item.findUniqueOrThrow({ where: { code: 'LAPTOP-001' }, select: { id: true } })
        ).id,
      },
    },
    update: {
      qtyOnHand: 10,
      avgCost: 800,
    },
    create: {
      warehouseId: mainWarehouse.id,
      itemId: (
        await prisma.item.findUniqueOrThrow({ where: { code: 'LAPTOP-001' }, select: { id: true } })
      ).id,
      qtyOnHand: 10,
      avgCost: 800,
    },
  });

  await seedOpeningLedgerBalances(
    adminUser.id,
    new Date(Date.UTC(currentYear, 0, 1)),
  );

  console.log('Seed completed successfully.');
  console.log('');
  console.log('Default login credentials:');
  console.log(`  admin@erp.local / ${DEFAULT_PASSWORD}`);
  console.log(`  manager@erp.local / ${DEFAULT_PASSWORD}`);
  console.log(`  sales@erp.local / ${DEFAULT_PASSWORD}`);
  console.log(`  purchase@erp.local / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
