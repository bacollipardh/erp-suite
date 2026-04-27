import { Module } from '@nestjs/common';
import { SalesReturnsService } from './sales-returns.service';
import { SalesReturnsController } from './sales-returns.controller';
import { StockModule } from '../stock/stock.module';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';
import { AccountingModule } from '../accounting/accounting.module';
import { SalesReturnApprovalGateService } from './sales-return-approval-gate.service';

@Module({
  imports: [StockModule, FinancialPeriodsModule, AccountingModule],
  controllers: [SalesReturnsController],
  providers: [SalesReturnsService, SalesReturnApprovalGateService],
  exports: [SalesReturnsService],
})
export class SalesReturnsModule {}
