import { Module } from '@nestjs/common';
import { FinanceReconciliationController } from './finance-reconciliation.controller';
import { FinanceReconciliationService } from './finance-reconciliation.service';

@Module({
  controllers: [FinanceReconciliationController],
  providers: [FinanceReconciliationService],
  exports: [FinanceReconciliationService],
})
export class FinanceReconciliationModule {}
