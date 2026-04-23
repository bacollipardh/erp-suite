import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { GenerateFinancialPeriodsDto } from './dto/generate-financial-periods.dto';
import { ListFinancialPeriodsQueryDto } from './dto/list-financial-periods-query.dto';
import { UpdateFinancialPeriodStatusDto } from './dto/update-financial-period-status.dto';
import { FinancialPeriodsService } from './financial-periods.service';

@ApiTags('financial-periods')
@ApiBearerAuth()
@Controller('financial-periods')
export class FinancialPeriodsController {
  constructor(private readonly financialPeriodsService: FinancialPeriodsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.financialPeriodsRead)
  findAll(@Query() query: ListFinancialPeriodsQueryDto) {
    return this.financialPeriodsService.findAll(query);
  }

  @Get(':id/summary')
  @RequirePermissions(PERMISSIONS.financialPeriodsRead)
  getSummary(@Param('id') id: string) {
    return this.financialPeriodsService.getSummary(id);
  }

  @Post('generate')
  @RequirePermissions(PERMISSIONS.financialPeriodsManage)
  generate(
    @Body() dto: GenerateFinancialPeriodsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financialPeriodsService.generateYear(dto.year, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.financialPeriodsManage)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialPeriodStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financialPeriodsService.updateStatus(id, dto, user.sub);
  }
}
