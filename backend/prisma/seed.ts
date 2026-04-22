import { FinanceAccountType, FiscalMode, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Admin123!';
const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const COMPANY_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

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

async function main() {
  console.log('Seeding database...');

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

  await upsertUser({
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
