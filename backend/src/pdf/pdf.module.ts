import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { PurchaseInvoicesModule } from '../purchase-invoices/purchase-invoices.module';
import { SalesInvoicesModule } from '../sales-invoices/sales-invoices.module';
import { SalesReturnsModule } from '../sales-returns/sales-returns.module';
import { CompanyProfileModule } from '../company-profile/company-profile.module';

@Module({
  imports: [PurchaseInvoicesModule, SalesInvoicesModule, SalesReturnsModule, CompanyProfileModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
