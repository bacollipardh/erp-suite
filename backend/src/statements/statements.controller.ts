import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { StatementsService } from './statements.service';

@ApiTags('statements')
@ApiBearerAuth()
@Controller('statements')
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Get('customers')
  @RequirePermissions(PERMISSIONS.reportsReceivables)
  getCustomerStatement(
    @Query('customerId') customerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.statementsService.getCustomerStatement({ customerId, dateFrom, dateTo, limit });
  }

  @Get('suppliers')
  @RequirePermissions(PERMISSIONS.reportsPayables)
  getSupplierStatement(
    @Query('supplierId') supplierId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.statementsService.getSupplierStatement({ supplierId, dateFrom, dateTo, limit });
  }

  @Get('customers/ledger')
  @RequirePermissions(PERMISSIONS.reportsReceivables)
  getCustomerLedger(
    @Query('customerId') customerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.statementsService.getCustomerLedger({ customerId, dateFrom, dateTo, limit });
  }

  @Get('suppliers/ledger')
  @RequirePermissions(PERMISSIONS.reportsPayables)
  getSupplierLedger(
    @Query('supplierId') supplierId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.statementsService.getSupplierLedger({ supplierId, dateFrom, dateTo, limit });
  }
}
