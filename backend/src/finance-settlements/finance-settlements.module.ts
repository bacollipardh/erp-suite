import { Module } from '@nestjs/common';
import { FinanceSettlementsController } from './finance-settlements.controller';
import { FinanceSettlementsService } from './finance-settlements.service';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [FinancialPeriodsModule, AccountingModule],
  controllers: [FinanceSettlementsController],
  providers: [FinanceSettlementsService],
  exports: [FinanceSettlementsService],
})
export class FinanceSettlementsModule {}
