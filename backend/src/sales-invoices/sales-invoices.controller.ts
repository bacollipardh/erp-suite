import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SalesInvoicesService } from './sales-invoices.service';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RecordPaymentDto } from '../common/dto/record-payment.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';

@ApiTags('sales-invoices')
@ApiBearerAuth()
@Controller('sales-invoices')
export class SalesInvoicesController {
  constructor(private readonly salesInvoicesService: SalesInvoicesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.salesInvoicesRead)
  findAll(@Query() query: PaginationDto) {
    return this.salesInvoicesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.salesInvoicesRead)
  findOne(@Param('id') id: string) {
    return this.salesInvoicesService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.salesInvoicesManage)
  create(@Body() dto: CreateSalesInvoiceDto, @CurrentUser() user: JwtPayload) {
    return this.salesInvoicesService.create(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.salesInvoicesManage)
  update(@Param('id') id: string, @Body() dto: UpdateSalesInvoiceDto) {
    return this.salesInvoicesService.update(id, dto);
  }

  @Post(':id/post')
  @RequirePermissions(PERMISSIONS.salesInvoicesManage)
  post(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.salesInvoicesService.post(id, user.sub);
  }

  @Post(':id/payments')
  @RequirePermissions(PERMISSIONS.salesInvoicesPay)
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesInvoicesService.recordPayment(id, dto, user.sub);
  }
}
