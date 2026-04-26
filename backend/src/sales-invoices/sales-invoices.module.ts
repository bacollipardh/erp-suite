import { Module } from '@nestjs/common';
import { SalesInvoicesService } from './sales-invoices.service';
import { SalesInvoicesController } from './sales-invoices.controller';
import { StockModule } from '../stock/stock.module';
import { FinanceAccountsModule } from '../finance-accounts/finance-accounts.module';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CustomerCreditApprovalGateService } from './customer-credit-approval-gate.service';

@Module({
  imports: [StockModule, FinanceAccountsModule, FinancialPeriodsModule, AccountingModule],
  controllers: [SalesInvoicesController],
  providers: [SalesInvoicesService, CustomerCreditApprovalGateService],
  exports: [SalesInvoicesService],
})
export class SalesInvoicesModule {}
