import { Module } from '@nestjs/common';
import { SalesInvoicesService } from './sales-invoices.service';
import { SalesInvoicesController } from './sales-invoices.controller';
import { StockModule } from '../stock/stock.module';
import { FinanceAccountsModule } from '../finance-accounts/finance-accounts.module';

@Module({
  imports: [StockModule, FinanceAccountsModule],
  controllers: [SalesInvoicesController],
  providers: [SalesInvoicesService],
  exports: [SalesInvoicesService],
})
export class SalesInvoicesModule {}
