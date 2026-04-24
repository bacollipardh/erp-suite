import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompanyProfileModule } from '../company-profile/company-profile.module';
import { PdfModule } from '../pdf/pdf.module';
import { VatSettlementsModule } from '../vat-settlements/vat-settlements.module';
import { VatReturnsController } from './vat-returns.controller';
import { VatReturnsService } from './vat-returns.service';

@Module({
  imports: [
    AccountingModule,
    AuditLogsModule,
    CompanyProfileModule,
    PdfModule,
    VatSettlementsModule,
  ],
  controllers: [VatReturnsController],
  providers: [VatReturnsService],
})
export class VatReturnsModule {}
