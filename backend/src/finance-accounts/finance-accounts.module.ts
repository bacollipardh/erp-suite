import { Module } from '@nestjs/common';
import { FinanceAccountsController } from './finance-accounts.controller';
import { FinanceAccountsService } from './finance-accounts.service';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';

@Module({
  imports: [FinancialPeriodsModule],
  controllers: [FinanceAccountsController],
  providers: [FinanceAccountsService],
  exports: [FinanceAccountsService],
})
export class FinanceAccountsModule {}
