import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { ItemCategoriesModule } from './item-categories/item-categories.module';
import { UnitsModule } from './units/units.module';
import { TaxRatesModule } from './tax-rates/tax-rates.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { DocumentSeriesModule } from './document-series/document-series.module';
import { ItemsModule } from './items/items.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CustomersModule } from './customers/customers.module';
import { StockModule } from './stock/stock.module';
import { PurchaseInvoicesModule } from './purchase-invoices/purchase-invoices.module';
import { SalesInvoicesModule } from './sales-invoices/sales-invoices.module';
import { SalesReturnsModule } from './sales-returns/sales-returns.module';
import { PdfModule } from './pdf/pdf.module';
import { CompanyProfileModule } from './company-profile/company-profile.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { FiscalizationModule } from './fiscalization/fiscalization.module';
import { FinanceSettlementsModule } from './finance-settlements/finance-settlements.module';
import { FinanceAccountsModule } from './finance-accounts/finance-accounts.module';
import { FinanceReconciliationModule } from './finance-reconciliation/finance-reconciliation.module';
import { FinancialPeriodsModule } from './financial-periods/financial-periods.module';
import { AccountingModule } from './accounting/accounting.module';
import { VatSettlementsModule } from './vat-settlements/vat-settlements.module';
import { VatReturnsModule } from './vat-returns/vat-returns.module';
import { FinanceDocumentsModule } from './finance-documents/finance-documents.module';
import { StatementsModule } from './statements/statements.module';
import { ControlTowerModule } from './control-tower/control-tower.module';
import { CompanyPulseModule } from './company-pulse/company-pulse.module';
import { CustomerRiskModule } from './customer-risk/customer-risk.module';
import { SupplierRiskModule } from './supplier-risk/supplier-risk.module';
import { ApprovalsModule } from './approvals/approvals.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    AuditLogsModule,
    RolesModule,
    UsersModule,
    ItemCategoriesModule,
    UnitsModule,
    TaxRatesModule,
    WarehousesModule,
    PaymentMethodsModule,
    DocumentSeriesModule,
    ItemsModule,
    SuppliersModule,
    CustomersModule,
    StockModule,
    PurchaseInvoicesModule,
    SalesInvoicesModule,
    SalesReturnsModule,
    PdfModule,
    CompanyProfileModule,
    DashboardModule,
    ReportsModule,
    FiscalizationModule,
    FinanceSettlementsModule,
    FinanceAccountsModule,
    FinanceReconciliationModule,
    FinancialPeriodsModule,
    AccountingModule,
    VatSettlementsModule,
    VatReturnsModule,
    FinanceDocumentsModule,
    StatementsModule,
    ControlTowerModule,
    CompanyPulseModule,
    CustomerRiskModule,
    SupplierRiskModule,
    ApprovalsModule,
  ],
})
export class AppModule {}
