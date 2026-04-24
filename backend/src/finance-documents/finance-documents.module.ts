import { Module } from '@nestjs/common';
import { FinanceAccountsModule } from '../finance-accounts/finance-accounts.module';
import { FinancialPeriodsModule } from '../financial-periods/financial-periods.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FinanceDocumentsController } from './finance-documents.controller';
import { FinanceDocumentsService } from './finance-documents.service';

@Module({
  imports: [PrismaModule, FinanceAccountsModule, FinancialPeriodsModule],
  controllers: [FinanceDocumentsController],
  providers: [FinanceDocumentsService],
})
export class FinanceDocumentsModule {}
