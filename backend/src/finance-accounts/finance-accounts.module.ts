import { Module } from '@nestjs/common';
import { FinanceAccountsController } from './finance-accounts.controller';
import { FinanceAccountsService } from './finance-accounts.service';

@Module({
  controllers: [FinanceAccountsController],
  providers: [FinanceAccountsService],
  exports: [FinanceAccountsService],
})
export class FinanceAccountsModule {}
