import { Module } from '@nestjs/common';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { ManualJournalApprovalGateService } from './manual-journal-approval-gate.service';

@Module({
  imports: [FinancialPeriodsModule],
  controllers: [AccountingController],
  providers: [AccountingService, ManualJournalApprovalGateService],
  exports: [AccountingService],
})
export class AccountingModule {}
