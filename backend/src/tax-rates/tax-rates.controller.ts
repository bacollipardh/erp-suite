import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TaxRatesService } from './tax-rates.service';
import { CreateTaxRateDto } from './dto/createTaxRate.dto';
import { UpdateTaxRateDto } from './dto/updateTaxRate.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';

@Controller('tax-rates')
export class TaxRatesController {
  constructor(private readonly service: TaxRatesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.taxRatesRead)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.taxRatesRead)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.taxRatesManage)
  create(@Body() dto: CreateTaxRateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.taxRatesManage)
  update(@Param('id') id: string, @Body() dto: UpdateTaxRateDto) {
    return this.service.update(id, dto);
  }
}
