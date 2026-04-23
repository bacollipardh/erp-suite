import { Module } from '@nestjs/common';
import { FinanceAccountsController } from './finance-accounts.controller';
import { FinanceAccountsService } from './finance-accounts.service';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [FinancialPeriodsModule, AccountingModule],
  controllers: [FinanceAccountsController],
  providers: [FinanceAccountsService],
  exports: [FinanceAccountsService],
})
export class FinanceAccountsModule {}
