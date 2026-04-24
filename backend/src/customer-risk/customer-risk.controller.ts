import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CustomerRiskService } from './customer-risk.service';

@ApiTags('customer-risk')
@ApiBearerAuth()
@Controller('control-tower/customer-risk')
export class CustomerRiskController {
  constructor(private readonly customerRiskService: CustomerRiskService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.dashboard)
  findAll(
    @Query('search') search?: string,
    @Query('risk') risk?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customerRiskService.findAll({ search, risk, limit });
  }
}
