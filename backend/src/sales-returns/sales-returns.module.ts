import { Module } from '@nestjs/common';
import { SalesReturnsService } from './sales-returns.service';
import { SalesReturnsController } from './sales-returns.controller';
import { StockModule } from '../stock/stock.module';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';

@Module({
  imports: [StockModule, FinancialPeriodsModule],
  controllers: [SalesReturnsController],
  providers: [SalesReturnsService],
  exports: [SalesReturnsService],
})
export class SalesReturnsModule {}
