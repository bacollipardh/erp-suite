import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CreateVatSettlementDto } from './dto/create-vat-settlement.dto';
import { FileVatSettlementDto } from './dto/file-vat-settlement.dto';
import { ListVatSettlementsQueryDto } from './dto/list-vat-settlements-query.dto';
import { RecordVatPaymentDto } from './dto/record-vat-payment.dto';
import { VatSettlementPreviewDto } from './dto/vat-settlement-preview.dto';
import { VatSettlementsService } from './vat-settlements.service';

@ApiTags('vat-settlements')
@ApiBearerAuth()
@Controller('vat-settlements')
export class VatSettlementsController {
  constructor(private readonly vatSettlementsService: VatSettlementsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.accountingRead)
  findAll(@Query() query: ListVatSettlementsQueryDto) {
    return this.vatSettlementsService.findAll(query);
  }

  @Get('preview')
  @RequirePermissions(PERMISSIONS.accountingRead)
  getPreview(@Query() query: VatSettlementPreviewDto) {
    return this.vatSettlementsService.getPreview(query.financialPeriodId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.accountingRead)
  getOne(@Param('id') id: string) {
    return this.vatSettlementsService.getOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.accountingManage)
  createOrUpdate(
    @Body() dto: CreateVatSettlementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vatSettlementsService.createOrUpdate(dto, user.sub);
  }

  @Patch(':id/file')
  @RequirePermissions(PERMISSIONS.accountingManage)
  fileSettlement(
    @Param('id') id: string,
    @Body() dto: FileVatSettlementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vatSettlementsService.fileSettlement(id, dto, user.sub);
  }

  @Post(':id/payments')
  @RequirePermissions(PERMISSIONS.accountingManage)
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordVatPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vatSettlementsService.recordPayment(id, dto, user.sub);
  }
}
