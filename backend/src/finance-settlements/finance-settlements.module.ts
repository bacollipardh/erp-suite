import { Module } from '@nestjs/common';
import { FinanceSettlementsController } from './finance-settlements.controller';
import { FinanceSettlementsService } from './finance-settlements.service';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';

@Module({
  imports: [FinancialPeriodsModule],
  controllers: [FinanceSettlementsController],
  providers: [FinanceSettlementsService],
  exports: [FinanceSettlementsService],
})
export class FinanceSettlementsModule {}
