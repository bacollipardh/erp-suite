import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { UpdatePurchaseInvoiceDto } from './dto/update-purchase-invoice.dto';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RecordPaymentDto } from '../common/dto/record-payment.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';

@ApiTags('purchase-invoices')
@ApiBearerAuth()
@Controller('purchase-invoices')
export class PurchaseInvoicesController {
  constructor(private readonly purchaseInvoicesService: PurchaseInvoicesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.purchaseInvoicesRead)
  findAll(@Query() query: PaginationDto) {
    return this.purchaseInvoicesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesRead)
  findOne(@Param('id') id: string) {
    return this.purchaseInvoicesService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.purchaseInvoicesManage)
  create(@Body() dto: CreatePurchaseInvoiceDto, @CurrentUser() user: JwtPayload) {
    return this.purchaseInvoicesService.create(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesManage)
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseInvoiceDto) {
    return this.purchaseInvoicesService.update(id, dto);
  }

  @Post(':id/post')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesManage)
  post(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.purchaseInvoicesService.post(id, user.sub);
  }

  @Post(':id/payments')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesPay)
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.purchaseInvoicesService.recordPayment(id, dto, user.sub);
  }
}
