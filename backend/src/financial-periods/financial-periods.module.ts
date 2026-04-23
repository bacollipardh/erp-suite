import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FinancialPeriodsController } from './financial-periods.controller';
import { FinancialPeriodsService } from './financial-periods.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [FinancialPeriodsController],
  providers: [FinancialPeriodsService],
  exports: [FinancialPeriodsService],
})
export class FinancialPeriodsModule {}
