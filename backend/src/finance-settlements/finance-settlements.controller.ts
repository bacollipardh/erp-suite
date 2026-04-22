import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { ApplyFinanceSettlementDto } from './dto/apply-finance-settlement.dto';
import { ListFinanceSettlementsQueryDto } from './dto/list-finance-settlements-query.dto';
import { FinanceSettlementsService } from './finance-settlements.service';

@ApiTags('finance-settlements')
@ApiBearerAuth()
@Controller('finance-settlements')
export class FinanceSettlementsController {
  constructor(private readonly financeSettlementsService: FinanceSettlementsService) {}

  @Get('receipts')
  @RequirePermissions(PERMISSIONS.salesInvoicesPay)
  getReceiptSettlements(@Query() query: ListFinanceSettlementsQueryDto) {
    return this.financeSettlementsService.getReceiptSettlements(query);
  }

  @Get('receipts/:id/targets')
  @RequirePermissions(PERMISSIONS.salesInvoicesPay)
  getReceiptTargets(@Param('id') id: string) {
    return this.financeSettlementsService.getReceiptTargets(id);
  }

  @Post('receipts/:id/apply')
  @RequirePermissions(PERMISSIONS.salesInvoicesPay)
  applyReceiptSettlement(
    @Param('id') id: string,
    @Body() dto: ApplyFinanceSettlementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeSettlementsService.applyReceiptSettlement(id, dto, user.sub);
  }

  @Get('payments')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesPay)
  getPaymentSettlements(@Query() query: ListFinanceSettlementsQueryDto) {
    return this.financeSettlementsService.getPaymentSettlements(query);
  }

  @Get('payments/:id/targets')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesPay)
  getPaymentTargets(@Param('id') id: string) {
    return this.financeSettlementsService.getPaymentTargets(id);
  }

  @Post('payments/:id/apply')
  @RequirePermissions(PERMISSIONS.purchaseInvoicesPay)
  applyPaymentSettlement(
    @Param('id') id: string,
    @Body() dto: ApplyFinanceSettlementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeSettlementsService.applyPaymentSettlement(id, dto, user.sub);
  }
}
