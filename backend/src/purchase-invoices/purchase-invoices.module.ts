import { Module } from '@nestjs/common';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { PurchaseInvoicesController } from './purchase-invoices.controller';
import { StockModule } from '../stock/stock.module';
import { FinanceAccountsModule } from '../finance-accounts/finance-accounts.module';

@Module({
  imports: [StockModule, FinanceAccountsModule],
  controllers: [PurchaseInvoicesController],
  providers: [PurchaseInvoicesService],
  exports: [PurchaseInvoicesService],
})
export class PurchaseInvoicesModule {}
