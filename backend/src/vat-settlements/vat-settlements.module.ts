import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FinanceAccountsModule } from '../finance-accounts/finance-accounts.module';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';
import { VatSettlementsController } from './vat-settlements.controller';
import { VatSettlementsService } from './vat-settlements.service';

@Module({
  imports: [
    AuditLogsModule,
    FinancialPeriodsModule,
    AccountingModule,
    FinanceAccountsModule,
  ],
  controllers: [VatSettlementsController],
  providers: [VatSettlementsService],
  exports: [VatSettlementsService],
})
export class VatSettlementsModule {}
