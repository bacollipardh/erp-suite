import { Module } from '@nestjs/common';
import { FinanceReconciliationController } from './finance-reconciliation.controller';
import { FinanceReconciliationService } from './finance-reconciliation.service';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';

@Module({
  imports: [FinancialPeriodsModule],
  controllers: [FinanceReconciliationController],
  providers: [FinanceReconciliationService],
  exports: [FinanceReconciliationService],
})
export class FinanceReconciliationModule {}
