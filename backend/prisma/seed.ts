import {
  AgentOrderStatus,
  AgentOrderType,
  FinanceAccountTransactionType,
  FinanceAccountType,
  FiscalMode,
  JournalEntryLineSide,
  LedgerAccountCategory,
  LedgerAccountReportSection,
  MovementType,
  PrismaClient,
  WmsInventoryStatus,
  WmsLocationStatus,
  WmsLocationType,
  WmsMovementType,
  WmsTaskStatus,
  WmsTaskType,
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
  vatReceivable: 'VAT_RECEIVABLE',
  vatOutput: 'VAT_OUTPUT',
  vatPayable: 'VAT_PAYABLE',
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
    code: SYSTEM_LEDGER_ACCOUNT_CODES.vatReceivable,
    name: 'TVSH e Arketueshme',
    category: LedgerAccountCategory.ASSET,
    reportSection: LedgerAccountReportSection.CURRENT_ASSET,
    sortOrder: 1325,
    description:
      'Teprica e TVSH-se qe pret kompensim ose rimbursim pas settlement-it.',
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
    description:
      'Konto manuale per accruals, detyrime te pambyllura dhe provizione operative.',
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
    code: SYSTEM_LEDGER_ACCOUNT_CODES.vatPayable,
    name: 'Detyrim TVSH',
    category: LedgerAccountCategory.LIABILITY,
    reportSection: LedgerAccountReportSection.CURRENT_LIABILITY,
    sortOrder: 2225,
    description: 'Detyrimi neto i TVSH-se pas settlement-it mujor.',
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

  const openingBalance = Number(
    existing?.openingBalance ?? params.openingBalance ?? 0,
  );
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

function seedDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function upsertCustomerObject(params: {
  customerId: string;
  code: string;
  name: string;
  address?: string | null;
  city?: string | null;
  contactName?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  return prisma.customerObject.upsert({
    where: {
      customerId_code: {
        customerId: params.customerId,
        code: params.code,
      },
    },
    update: {
      name: params.name,
      address: params.address ?? null,
      city: params.city ?? null,
      contactName: params.contactName ?? null,
      phone: params.phone ?? null,
      isActive: true,
      notes: params.notes ?? null,
    },
    create: {
      customerId: params.customerId,
      code: params.code,
      name: params.name,
      address: params.address ?? null,
      city: params.city ?? null,
      contactName: params.contactName ?? null,
      phone: params.phone ?? null,
      isActive: true,
      notes: params.notes ?? null,
    },
  });
}

async function upsertWmsLocation(params: {
  warehouseId: string;
  code: string;
  barcode: string;
  zone: string;
  aisle?: string | null;
  rack?: string | null;
  shelf?: string | null;
  bin?: string | null;
  locationType: WmsLocationType;
  status?: WmsLocationStatus;
  maxQty?: number | null;
  notes?: string | null;
}) {
  return prisma.wmsLocation.upsert({
    where: {
      warehouseId_code: {
        warehouseId: params.warehouseId,
        code: params.code,
      },
    },
    update: {
      barcode: params.barcode,
      zone: params.zone,
      aisle: params.aisle ?? null,
      rack: params.rack ?? null,
      shelf: params.shelf ?? null,
      bin: params.bin ?? null,
      locationType: params.locationType,
      status: params.status ?? WmsLocationStatus.ACTIVE,
      maxQty: params.maxQty ?? null,
      notes: params.notes ?? null,
    },
    create: {
      warehouseId: params.warehouseId,
      code: params.code,
      barcode: params.barcode,
      zone: params.zone,
      aisle: params.aisle ?? null,
      rack: params.rack ?? null,
      shelf: params.shelf ?? null,
      bin: params.bin ?? null,
      locationType: params.locationType,
      status: params.status ?? WmsLocationStatus.ACTIVE,
      maxQty: params.maxQty ?? null,
      notes: params.notes ?? null,
    },
  });
}

async function upsertStockBalance(params: {
  warehouseId: string;
  itemId: string;
  qtyOnHand: number;
  avgCost: number;
}) {
  return prisma.stockBalance.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: params.warehouseId,
        itemId: params.itemId,
      },
    },
    update: {
      qtyOnHand: params.qtyOnHand,
      avgCost: params.avgCost,
    },
    create: {
      warehouseId: params.warehouseId,
      itemId: params.itemId,
      qtyOnHand: params.qtyOnHand,
      avgCost: params.avgCost,
    },
  });
}

async function upsertStockOpeningMovement(params: {
  warehouseId: string;
  itemId: string;
  qtyIn: number;
  unitCost: number;
  referenceNo: string;
  movementAt: Date;
}) {
  const existing = await prisma.stockMovement.findFirst({
    where: {
      warehouseId: params.warehouseId,
      itemId: params.itemId,
      movementType: MovementType.ADJUSTMENT_PLUS,
      referenceNo: params.referenceNo,
    },
    select: { id: true },
  });

  const data = {
    warehouseId: params.warehouseId,
    itemId: params.itemId,
    movementType: MovementType.ADJUSTMENT_PLUS,
    qtyIn: params.qtyIn,
    qtyOut: 0,
    unitCost: params.unitCost,
    referenceNo: params.referenceNo,
    movementAt: params.movementAt,
  };

  if (existing) {
    return prisma.stockMovement.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.stockMovement.create({ data });
}

async function upsertWmsStock(params: {
  warehouseId: string;
  locationId: string;
  itemId: string;
  qtyOnHand: number;
  lotCode?: string | null;
  serialNo?: string | null;
  expiryDate?: Date | null;
  manufacturingDate?: Date | null;
  inventoryStatus?: WmsInventoryStatus;
}) {
  const existing = await prisma.wmsStock.findFirst({
    where: {
      warehouseId: params.warehouseId,
      locationId: params.locationId,
      itemId: params.itemId,
      lotCode: params.lotCode ?? null,
      serialNo: params.serialNo ?? null,
      expiryDate: params.expiryDate ?? null,
      inventoryStatus: params.inventoryStatus ?? WmsInventoryStatus.AVAILABLE,
    },
    select: { id: true },
  });

  const data = {
    warehouseId: params.warehouseId,
    locationId: params.locationId,
    itemId: params.itemId,
    lotCode: params.lotCode ?? null,
    serialNo: params.serialNo ?? null,
    expiryDate: params.expiryDate ?? null,
    manufacturingDate: params.manufacturingDate ?? null,
    qtyOnHand: params.qtyOnHand,
    reservedQty: 0,
    pickedQty: 0,
    inventoryStatus: params.inventoryStatus ?? WmsInventoryStatus.AVAILABLE,
  };

  if (existing) {
    return prisma.wmsStock.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.wmsStock.create({ data });
}

async function upsertWmsOpeningMovement(params: {
  warehouseId: string;
  locationId: string;
  itemId: string;
  qty: number;
  referenceNo: string;
  createdById: string;
  lotCode?: string | null;
  serialNo?: string | null;
  expiryDate?: Date | null;
}) {
  const existing = await prisma.wmsMovement.findFirst({
    where: {
      warehouseId: params.warehouseId,
      itemId: params.itemId,
      toLocationId: params.locationId,
      movementType: WmsMovementType.RECEIVE,
      referenceNo: params.referenceNo,
      lotCode: params.lotCode ?? null,
      serialNo: params.serialNo ?? null,
      expiryDate: params.expiryDate ?? null,
    },
    select: { id: true },
  });

  const data = {
    warehouseId: params.warehouseId,
    itemId: params.itemId,
    toLocationId: params.locationId,
    movementType: WmsMovementType.RECEIVE,
    qty: params.qty,
    lotCode: params.lotCode ?? null,
    serialNo: params.serialNo ?? null,
    expiryDate: params.expiryDate ?? null,
    sourceType: 'SEED_OPENING',
    referenceNo: params.referenceNo,
    notes: 'Seed opening WMS stock',
    createdById: params.createdById,
  };

  if (existing) {
    return prisma.wmsMovement.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.wmsMovement.create({ data });
}

async function upsertWmsTask(params: {
  warehouseId: string;
  itemId?: string | null;
  sourceLocationId?: string | null;
  destinationLocationId?: string | null;
  taskType: WmsTaskType;
  status: WmsTaskStatus;
  qty?: number | null;
  referenceNo: string;
  assignedToId?: string | null;
  createdById: string;
  priority?: number;
  notes?: string | null;
}) {
  const existing = await prisma.wmsTask.findFirst({
    where: {
      taskType: params.taskType,
      sourceType: 'SEED_DEMO',
      referenceNo: params.referenceNo,
    },
    select: { id: true },
  });

  const data = {
    warehouseId: params.warehouseId,
    itemId: params.itemId ?? null,
    sourceLocationId: params.sourceLocationId ?? null,
    destinationLocationId: params.destinationLocationId ?? null,
    taskType: params.taskType,
    status: params.status,
    qty: params.qty ?? null,
    sourceType: 'SEED_DEMO',
    referenceNo: params.referenceNo,
    assignedToId: params.assignedToId ?? null,
    priority: params.priority ?? 5,
    notes: params.notes ?? null,
    createdById: params.createdById,
    completedAt: params.status === WmsTaskStatus.DONE ? new Date() : null,
  };

  if (existing) {
    return prisma.wmsTask.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.wmsTask.create({ data });
}

async function upsertDemoAgentOrder(params: {
  orderNo: string;
  orderType: AgentOrderType;
  status: AgentOrderStatus;
  customerId: string;
  customerObjectId?: string | null;
  warehouseId: string;
  createdById: string;
  assignedPickerId?: string | null;
  lines: Array<{
    itemId: string;
    description: string;
    qty: number;
    unitPrice: number;
    taxPercent: number;
  }>;
}) {
  const existing = await prisma.agentOrder.findUnique({
    where: { orderNo: params.orderNo },
    select: { id: true },
  });

  const orderData = {
    orderType: params.orderType,
    status: params.status,
    customerId: params.customerId,
    customerObjectId: params.customerObjectId ?? null,
    warehouseId: params.warehouseId,
    docDate: seedDate(new Date().getUTCFullYear(), 4, 28),
    dueDate: seedDate(new Date().getUTCFullYear(), 5, 5),
    priority: 3,
    assignedPickerId: params.assignedPickerId ?? null,
    assignedAt: params.assignedPickerId ? new Date() : null,
    notes: 'Demo order per testim Agent -> WMS -> Fature.',
    createdById: params.createdById,
  };

  const lineCreates = params.lines.map((line, index) => ({
    lineNo: index + 1,
    itemId: line.itemId,
    description: line.description,
    qty: line.qty,
    unitPrice: line.unitPrice,
    discountPercent: 0,
    taxPercent: line.taxPercent,
  }));

  if (existing) {
    await prisma.agentOrderLine.deleteMany({
      where: { agentOrderId: existing.id },
    });

    return prisma.agentOrder.update({
      where: { id: existing.id },
      data: {
        ...orderData,
        lines: { create: lineCreates },
      },
      include: { lines: true },
    });
  }

  return prisma.agentOrder.create({
    data: {
      orderNo: params.orderNo,
      ...orderData,
      lines: { create: lineCreates },
    },
    include: { lines: true },
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
        sortOrder:
          account.accountType === FinanceAccountType.CASH ? 1010 : 1020,
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
        sortOrder:
          account.accountType === FinanceAccountType.CASH ? 1010 : 1020,
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

  const wmsRole = await prisma.role.upsert({
    where: { code: 'WMS' },
    update: { name: 'Warehouse Picker', isActive: true },
    create: { code: 'WMS', name: 'Warehouse Picker', isActive: true },
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

  const pickerUser = await prisma.user.upsert({
    where: { email: 'picker@erp.local' },
    update: {
      roleId: wmsRole.id,
      fullName: 'Warehouse Picker',
      passwordHash,
      isActive: true,
    },
    create: {
      roleId: wmsRole.id,
      fullName: 'Warehouse Picker',
      email: 'picker@erp.local',
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

  const accessoriesCategory = await prisma.itemCategory.upsert({
    where: { code: 'ACCESSORIES' },
    update: { name: 'Accessories', parentId: goodsCategory.id },
    create: {
      code: 'ACCESSORIES',
      name: 'Accessories',
      parentId: goodsCategory.id,
    },
  });

  const electronicsCategory = await prisma.itemCategory.upsert({
    where: { code: 'ELECTRONICS' },
    update: { name: 'Electronics', parentId: goodsCategory.id },
    create: {
      code: 'ELECTRONICS',
      name: 'Electronics',
      parentId: goodsCategory.id,
    },
  });

  const consumablesCategory = await prisma.itemCategory.upsert({
    where: { code: 'CONSUMABLES' },
    update: { name: 'Consumables', parentId: goodsCategory.id },
    create: {
      code: 'CONSUMABLES',
      name: 'Consumables',
      parentId: goodsCategory.id,
    },
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

  const unitPack = await prisma.unit.upsert({
    where: { code: 'PAK' },
    update: { name: 'Pako' },
    create: { code: 'PAK', name: 'Pako' },
  });

  const unitHour = await prisma.unit.upsert({
    where: { code: 'ORE' },
    update: { name: 'Ore' },
    create: { code: 'ORE', name: 'Ore' },
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
    update: {
      name: 'Main Warehouse',
      address: 'Prishtine, Kosovo',
      isActive: true,
    },
    create: {
      code: 'MAIN',
      name: 'Main Warehouse',
      address: 'Prishtine, Kosovo',
      isActive: true,
    },
  });

  const secondaryWarehouse = await prisma.warehouse.upsert({
    where: { code: 'SECONDARY' },
    update: {
      name: 'Secondary Warehouse',
      address: 'Prizren, Kosovo',
      isActive: true,
    },
    create: {
      code: 'SECONDARY',
      name: 'Secondary Warehouse',
      address: 'Prizren, Kosovo',
      isActive: true,
    },
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

  await prisma.paymentMethod.upsert({
    where: { code: 'CARD' },
    update: { name: 'Card POS', isActive: true },
    create: { code: 'CARD', name: 'Card POS', isActive: true },
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

  await upsertFinanceAccount({
    code: 'CARD_POS',
    name: 'Card POS Clearing',
    accountType: FinanceAccountType.BANK,
    bankName: 'POS Processor',
    bankAccountNo: 'POS-001',
    openingBalance: 250,
    notes: 'Llogari per arketimet me kartele deri ne pajtim bankar.',
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

  const laptop = await prisma.item.upsert({
    where: { code: 'LAPTOP-001' },
    update: {
      barcode: '383000000001',
      name: 'Laptop Pro 15',
      description: 'Serial tracked demo item',
      categoryId: electronicsCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 800,
      standardSalesPrice: 1100,
      minSalesPrice: 900,
      isActive: true,
    },
    create: {
      code: 'LAPTOP-001',
      barcode: '383000000001',
      name: 'Laptop Pro 15',
      description: 'Serial tracked demo item',
      categoryId: electronicsCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 800,
      standardSalesPrice: 1100,
      minSalesPrice: 900,
      isActive: true,
    },
  });

  const monitor = await prisma.item.upsert({
    where: { code: 'MONITOR-001' },
    update: {
      barcode: '383000000002',
      name: 'Monitor 24',
      description: 'Standard stock item',
      categoryId: electronicsCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 200,
      standardSalesPrice: 280,
      minSalesPrice: 230,
      isActive: true,
    },
    create: {
      code: 'MONITOR-001',
      barcode: '383000000002',
      name: 'Monitor 24',
      description: 'Standard stock item',
      categoryId: electronicsCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 200,
      standardSalesPrice: 280,
      minSalesPrice: 230,
      isActive: true,
    },
  });

  const mouse = await prisma.item.upsert({
    where: { code: 'MOUSE-001' },
    update: {
      barcode: '383000000003',
      name: 'Wireless Mouse',
      description: 'Fast moving accessory',
      categoryId: accessoriesCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 12,
      standardSalesPrice: 22,
      minSalesPrice: 16,
      isActive: true,
    },
    create: {
      code: 'MOUSE-001',
      barcode: '383000000003',
      name: 'Wireless Mouse',
      description: 'Fast moving accessory',
      categoryId: accessoriesCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 12,
      standardSalesPrice: 22,
      minSalesPrice: 16,
      isActive: true,
    },
  });

  const keyboard = await prisma.item.upsert({
    where: { code: 'KEYBOARD-001' },
    update: {
      barcode: '383000000004',
      name: 'Keyboard AL Layout',
      description: 'Standard stock item',
      categoryId: accessoriesCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 18,
      standardSalesPrice: 35,
      minSalesPrice: 25,
      isActive: true,
    },
    create: {
      code: 'KEYBOARD-001',
      barcode: '383000000004',
      name: 'Keyboard AL Layout',
      description: 'Standard stock item',
      categoryId: accessoriesCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 18,
      standardSalesPrice: 35,
      minSalesPrice: 25,
      isActive: true,
    },
  });

  const usbCable = await prisma.item.upsert({
    where: { code: 'USB-CABLE-001' },
    update: {
      barcode: '383000000005',
      name: 'USB-C Cable 1m',
      description: 'Small accessory for barcode scan tests',
      categoryId: accessoriesCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 3,
      standardSalesPrice: 7,
      minSalesPrice: 5,
      isActive: true,
    },
    create: {
      code: 'USB-CABLE-001',
      barcode: '383000000005',
      name: 'USB-C Cable 1m',
      description: 'Small accessory for barcode scan tests',
      categoryId: accessoriesCategory.id,
      unitId: unitPiece.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 3,
      standardSalesPrice: 7,
      minSalesPrice: 5,
      isActive: true,
    },
  });

  const coffee = await prisma.item.upsert({
    where: { code: 'COFFEE-001' },
    update: {
      barcode: '383000000006',
      name: 'Coffee 1kg',
      description: 'Lot and expiry tracked demo item',
      categoryId: consumablesCategory.id,
      unitId: unitPack.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 6,
      standardSalesPrice: 10,
      minSalesPrice: 8,
      isActive: true,
    },
    create: {
      code: 'COFFEE-001',
      barcode: '383000000006',
      name: 'Coffee 1kg',
      description: 'Lot and expiry tracked demo item',
      categoryId: consumablesCategory.id,
      unitId: unitPack.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 6,
      standardSalesPrice: 10,
      minSalesPrice: 8,
      isActive: true,
    },
  });

  const sugar = await prisma.item.upsert({
    where: { code: 'SUGAR-001' },
    update: {
      barcode: '383000000007',
      name: 'Sugar 1kg',
      description: 'Lot tracked demo item',
      categoryId: consumablesCategory.id,
      unitId: unitKg.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 0.7,
      standardSalesPrice: 1.2,
      minSalesPrice: 1,
      isActive: true,
    },
    create: {
      code: 'SUGAR-001',
      barcode: '383000000007',
      name: 'Sugar 1kg',
      description: 'Lot tracked demo item',
      categoryId: consumablesCategory.id,
      unitId: unitKg.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 0.7,
      standardSalesPrice: 1.2,
      minSalesPrice: 1,
      isActive: true,
    },
  });

  await prisma.item.upsert({
    where: { code: 'CONSULT-001' },
    update: {
      barcode: null,
      name: 'IT Consulting',
      description: 'Service item without stock movement',
      categoryId: servicesCategory.id,
      unitId: unitHour.id,
      taxRateId: tax18.id,
      standardPurchasePrice: 0,
      standardSalesPrice: 65,
      isActive: true,
    },
    create: {
      code: 'CONSULT-001',
      name: 'IT Consulting',
      description: 'Service item without stock movement',
      categoryId: servicesCategory.id,
      unitId: unitHour.id,
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

  await prisma.supplier.upsert({
    where: { code: 'SUP-002' },
    update: {
      name: 'Office Wholesale LLC',
      fiscalNo: '70022345',
      vatNo: '331022345',
      address: 'Rr. Tirana 12',
      city: 'Prizren',
      phone: '+38344222333',
      email: 'orders@office-wholesale.local',
      paymentTermsDays: 15,
      isActive: true,
    },
    create: {
      code: 'SUP-002',
      name: 'Office Wholesale LLC',
      fiscalNo: '70022345',
      vatNo: '331022345',
      address: 'Rr. Tirana 12',
      city: 'Prizren',
      phone: '+38344222333',
      email: 'orders@office-wholesale.local',
      paymentTermsDays: 15,
      isActive: true,
    },
  });

  const customerAbc = await prisma.customer.upsert({
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

  const customerXyz = await prisma.customer.upsert({
    where: { code: 'CUS-002' },
    update: {
      name: 'Biznesi XYZ',
      fiscalNo: '70066666',
      vatNo: '331066666',
      address: 'Rr. Deshmoret 20',
      city: 'Ferizaj',
      phone: '+38344555777',
      email: 'office@xyz.local',
      creditLimit: 2500,
      isActive: true,
    },
    create: {
      code: 'CUS-002',
      name: 'Biznesi XYZ',
      fiscalNo: '70066666',
      vatNo: '331066666',
      address: 'Rr. Deshmoret 20',
      city: 'Ferizaj',
      phone: '+38344555777',
      email: 'office@xyz.local',
      creditLimit: 2500,
      isActive: true,
    },
  });

  const customerRetail = await prisma.customer.upsert({
    where: { code: 'CUS-003' },
    update: {
      name: 'Retail Test Customer',
      fiscalNo: '70077777',
      vatNo: '331077777',
      address: 'Rr. B 10',
      city: 'Prishtine',
      phone: '+38344555888',
      email: 'retail@test.local',
      creditLimit: 1000,
      defaultDiscountPercent: 0,
      isActive: true,
    },
    create: {
      code: 'CUS-003',
      name: 'Retail Test Customer',
      fiscalNo: '70077777',
      vatNo: '331077777',
      address: 'Rr. B 10',
      city: 'Prishtine',
      phone: '+38344555888',
      email: 'retail@test.local',
      creditLimit: 1000,
      defaultDiscountPercent: 0,
      isActive: true,
    },
  });

  const abcMainObject = await upsertCustomerObject({
    customerId: customerAbc.id,
    code: 'ABC-PR-01',
    name: 'ABC Qendra',
    address: 'Rr. Nena Tereze 1',
    city: 'Prishtine',
    contactName: 'Arben Krasniqi',
    phone: '+38344111000',
    notes: 'Objekt kryesor per porosite e agjentit.',
  });

  await upsertCustomerObject({
    customerId: customerAbc.id,
    code: 'ABC-WH-01',
    name: 'ABC Depo',
    address: 'Zona Industriale',
    city: 'Prishtine',
    contactName: 'Drita Berisha',
    phone: '+38344111001',
  });

  await upsertCustomerObject({
    customerId: customerXyz.id,
    code: 'XYZ-FZ-01',
    name: 'XYZ Market Ferizaj',
    address: 'Rr. Deshmoret 20',
    city: 'Ferizaj',
    contactName: 'Blerim Hoxha',
    phone: '+38344112000',
  });

  await upsertCustomerObject({
    customerId: customerRetail.id,
    code: 'RTL-PR-01',
    name: 'Retail POS Counter',
    address: 'Rr. B 10',
    city: 'Prishtine',
    contactName: 'Nora Gashi',
    phone: '+38344113000',
  });

  const receivingLocation = await upsertWmsLocation({
    warehouseId: mainWarehouse.id,
    code: 'MAIN-REC-01',
    barcode: 'LOC-MAIN-REC-01',
    zone: 'RECEIVING',
    aisle: 'R',
    rack: '01',
    shelf: '00',
    bin: '01',
    locationType: WmsLocationType.RECEIVING,
    maxQty: 500,
    notes: 'Lokacion per pranime fillestare.',
  });

  const storageLocation = await upsertWmsLocation({
    warehouseId: mainWarehouse.id,
    code: 'MAIN-A01-R01-S01-B01',
    barcode: 'LOC-MAIN-A01-R01-S01-B01',
    zone: 'A',
    aisle: '01',
    rack: 'R01',
    shelf: 'S01',
    bin: 'B01',
    locationType: WmsLocationType.STORAGE,
    maxQty: 300,
    notes: 'Storage kryesor per artikuj me rotacion normal.',
  });

  const pickingLocation = await upsertWmsLocation({
    warehouseId: mainWarehouse.id,
    code: 'MAIN-A01-R01-S01-B02',
    barcode: 'LOC-MAIN-A01-R01-S01-B02',
    zone: 'A',
    aisle: '01',
    rack: 'R01',
    shelf: 'S01',
    bin: 'B02',
    locationType: WmsLocationType.PICKING,
    maxQty: 150,
    notes: 'Lokacion picking per shitje te perditshme.',
  });

  await upsertWmsLocation({
    warehouseId: mainWarehouse.id,
    code: 'MAIN-PACK-01',
    barcode: 'LOC-MAIN-PACK-01',
    zone: 'PACK',
    aisle: 'P',
    rack: '01',
    shelf: '00',
    bin: '01',
    locationType: WmsLocationType.PACKING,
    maxQty: 100,
  });

  await upsertWmsLocation({
    warehouseId: mainWarehouse.id,
    code: 'MAIN-SHIP-01',
    barcode: 'LOC-MAIN-SHIP-01',
    zone: 'SHIP',
    aisle: 'S',
    rack: '01',
    shelf: '00',
    bin: '01',
    locationType: WmsLocationType.SHIPPING,
    maxQty: 100,
  });

  await upsertWmsLocation({
    warehouseId: mainWarehouse.id,
    code: 'MAIN-RET-01',
    barcode: 'LOC-MAIN-RET-01',
    zone: 'RETURNS',
    aisle: 'RT',
    rack: '01',
    shelf: '00',
    bin: '01',
    locationType: WmsLocationType.RETURNS,
    maxQty: 100,
    notes: 'Lokacion per kthime nga klientet.',
  });

  await upsertWmsLocation({
    warehouseId: mainWarehouse.id,
    code: 'MAIN-QC-01',
    barcode: 'LOC-MAIN-QC-01',
    zone: 'QC',
    aisle: 'Q',
    rack: '01',
    shelf: '00',
    bin: '01',
    locationType: WmsLocationType.QUARANTINE,
    status: WmsLocationStatus.QUARANTINE,
    maxQty: 100,
    notes: 'Karantine/QC per mall te kthyer ose te dyshimte.',
  });

  await upsertWmsLocation({
    warehouseId: mainWarehouse.id,
    code: 'MAIN-DMG-01',
    barcode: 'LOC-MAIN-DMG-01',
    zone: 'DAMAGED',
    aisle: 'D',
    rack: '01',
    shelf: '00',
    bin: '01',
    locationType: WmsLocationType.DAMAGED,
    status: WmsLocationStatus.DAMAGED,
    maxQty: 50,
    notes: 'Mall i demtuar, i bllokuar per shitje.',
  });

  await upsertWmsLocation({
    warehouseId: secondaryWarehouse.id,
    code: 'SEC-A01-R01-S01-B01',
    barcode: 'LOC-SEC-A01-R01-S01-B01',
    zone: 'A',
    aisle: '01',
    rack: 'R01',
    shelf: 'S01',
    bin: 'B01',
    locationType: WmsLocationType.STORAGE,
    maxQty: 200,
  });

  const openingAt = seedDate(currentYear, 1, 1);
  const openingRows = [
    { item: laptop, qty: 5, avgCost: 800, location: storageLocation },
    { item: monitor, qty: 18, avgCost: 200, location: pickingLocation },
    { item: mouse, qty: 120, avgCost: 12, location: pickingLocation },
    { item: keyboard, qty: 45, avgCost: 18, location: storageLocation },
    { item: usbCable, qty: 200, avgCost: 3, location: pickingLocation },
    { item: coffee, qty: 80, avgCost: 6, location: storageLocation },
    { item: sugar, qty: 150, avgCost: 0.7, location: storageLocation },
  ];

  for (const row of openingRows) {
    await upsertStockBalance({
      warehouseId: mainWarehouse.id,
      itemId: row.item.id,
      qtyOnHand: row.qty,
      avgCost: row.avgCost,
    });

    await upsertStockOpeningMovement({
      warehouseId: mainWarehouse.id,
      itemId: row.item.id,
      qtyIn: row.qty,
      unitCost: row.avgCost,
      referenceNo: `SEED-STOCK-${row.item.code}`,
      movementAt: openingAt,
    });
  }

  const laptopSerials = [
    'LP15-2026-0001',
    'LP15-2026-0002',
    'LP15-2026-0003',
    'LP15-2026-0004',
    'LP15-2026-0005',
  ];
  for (const serialNo of laptopSerials) {
    await upsertWmsStock({
      warehouseId: mainWarehouse.id,
      locationId: storageLocation.id,
      itemId: laptop.id,
      qtyOnHand: 1,
      serialNo,
      inventoryStatus: WmsInventoryStatus.AVAILABLE,
    });
    await upsertWmsOpeningMovement({
      warehouseId: mainWarehouse.id,
      locationId: storageLocation.id,
      itemId: laptop.id,
      qty: 1,
      referenceNo: `SEED-WMS-${serialNo}`,
      createdById: adminUser.id,
      serialNo,
    });
  }

  const aggregateWmsRows = [
    {
      item: monitor,
      qty: 18,
      location: pickingLocation,
      lotCode: null,
      expiryDate: null,
    },
    {
      item: mouse,
      qty: 120,
      location: pickingLocation,
      lotCode: null,
      expiryDate: null,
    },
    {
      item: keyboard,
      qty: 45,
      location: storageLocation,
      lotCode: null,
      expiryDate: null,
    },
    {
      item: usbCable,
      qty: 200,
      location: pickingLocation,
      lotCode: null,
      expiryDate: null,
    },
    {
      item: coffee,
      qty: 50,
      location: storageLocation,
      lotCode: 'LOT-COF-2026-01',
      expiryDate: seedDate(currentYear + 1, 1, 31),
    },
    {
      item: coffee,
      qty: 30,
      location: pickingLocation,
      lotCode: 'LOT-COF-2026-02',
      expiryDate: seedDate(currentYear + 1, 3, 31),
    },
    {
      item: sugar,
      qty: 150,
      location: storageLocation,
      lotCode: 'LOT-SUG-2026-01',
      expiryDate: seedDate(currentYear + 1, 6, 30),
    },
  ];

  for (const row of aggregateWmsRows) {
    await upsertWmsStock({
      warehouseId: mainWarehouse.id,
      locationId: row.location.id,
      itemId: row.item.id,
      qtyOnHand: row.qty,
      lotCode: row.lotCode,
      expiryDate: row.expiryDate,
      inventoryStatus: WmsInventoryStatus.AVAILABLE,
    });
    await upsertWmsOpeningMovement({
      warehouseId: mainWarehouse.id,
      locationId: row.location.id,
      itemId: row.item.id,
      qty: row.qty,
      referenceNo: `SEED-WMS-${row.item.code}-${row.lotCode ?? row.location.code}`,
      createdById: adminUser.id,
      lotCode: row.lotCode,
      expiryDate: row.expiryDate,
    });
  }

  await upsertWmsTask({
    warehouseId: mainWarehouse.id,
    itemId: monitor.id,
    sourceLocationId: pickingLocation.id,
    taskType: WmsTaskType.COUNT,
    status: WmsTaskStatus.PENDING,
    qty: 18,
    referenceNo: 'SEED-COUNT-MONITOR',
    assignedToId: pickerUser.id,
    createdById: adminUser.id,
    priority: 4,
    notes: 'Demo cycle count per lokacion picking.',
  });

  await upsertWmsTask({
    warehouseId: mainWarehouse.id,
    itemId: coffee.id,
    sourceLocationId: receivingLocation.id,
    destinationLocationId: storageLocation.id,
    taskType: WmsTaskType.PUTAWAY,
    status: WmsTaskStatus.PENDING,
    qty: 10,
    referenceNo: 'SEED-PUTAWAY-COFFEE',
    assignedToId: pickerUser.id,
    createdById: adminUser.id,
    priority: 3,
    notes: 'Demo putaway task per trajnimin e WMS.',
  });

  await upsertDemoAgentOrder({
    orderNo: 'AO-DEMO-0001',
    orderType: AgentOrderType.SALES_ORDER,
    status: AgentOrderStatus.SUBMITTED,
    customerId: customerAbc.id,
    customerObjectId: abcMainObject.id,
    warehouseId: mainWarehouse.id,
    createdById: adminUser.id,
    assignedPickerId: null,
    lines: [
      {
        itemId: monitor.id,
        description: 'Monitor per zyre',
        qty: 2,
        unitPrice: 280,
        taxPercent: 18,
      },
      {
        itemId: mouse.id,
        description: 'Mouse wireless per ekip',
        qty: 5,
        unitPrice: 22,
        taxPercent: 18,
      },
    ],
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
  console.log(`  picker@erp.local / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
