import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/createUnit.dto';
import { UpdateUnitDto } from './dto/updateUnit.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';

@Controller('units')
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.unitsRead)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.unitsRead)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.unitsManage)
  create(@Body() dto: CreateUnitDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.unitsManage)
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.service.update(id, dto);
  }
}
