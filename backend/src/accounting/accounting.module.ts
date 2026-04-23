import { Module } from '@nestjs/common';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [FinancialPeriodsModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
