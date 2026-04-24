import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { SupplierRiskService } from './supplier-risk.service';

@ApiTags('supplier-risk')
@ApiBearerAuth()
@Controller('control-tower/supplier-risk')
export class SupplierRiskController {
  constructor(private readonly supplierRiskService: SupplierRiskService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.dashboard)
  findAll(
    @Query('search') search?: string,
    @Query('risk') risk?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supplierRiskService.findAll({ search, risk, limit });
  }
}
