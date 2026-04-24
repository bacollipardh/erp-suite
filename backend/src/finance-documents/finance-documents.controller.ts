import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CreateCustomerReceiptDto } from './dto/create-customer-receipt.dto';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { FinanceDocumentsService } from './finance-documents.service';

@ApiTags('finance-documents')
@ApiBearerAuth()
@Controller()
export class FinanceDocumentsController {
  constructor(private readonly financeDocumentsService: FinanceDocumentsService) {}

  @Get('customer-receipts')
  @RequirePermissions(PERMISSIONS.salesInvoicesPay)
  findCustomerReceipts() {
    return this.financeDocumentsService.findCustomerReceipts();
  }

  @Get('customer-receipts/:id')
  @RequirePermissions(PERMISSIONS.salesInvoicesPay)
  findCustomerReceipt(@Param('id') id: string) {
    return this.financeDocumentsService.findCustomerReceipt(id);
  }

  @Post('customer-receipts')
  @RequirePermissions(PERMISSIONS.salesInvoicesPay)
  createCustomerReceipt(
    @Body() dto: CreateCustomerReceiptDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeDocumentsService.createCustomerReceipt(dto, user.sub);
  }

  @Post('customer-receipts/:id/post')
  @RequirePermissions(PERMISSIONS.salesInvoicesPay)
  postCustomerReceipt(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.financeDocumentsService.postCustomerReceipt(id, user.sub);
  }

  @Get('supplier-payments')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesPay)
  findSupplierPayments() {
    return this.financeDocumentsService.findSupplierPayments();
  }

  @Get('supplier-payments/:id')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesPay)
  findSupplierPayment(@Param('id') id: string) {
    return this.financeDocumentsService.findSupplierPayment(id);
  }

  @Post('supplier-payments')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesPay)
  createSupplierPayment(
    @Body() dto: CreateSupplierPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeDocumentsService.createSupplierPayment(dto, user.sub);
  }

  @Post('supplier-payments/:id/post')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesPay)
  postSupplierPayment(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.financeDocumentsService.postSupplierPayment(id, user.sub);
  }
}
