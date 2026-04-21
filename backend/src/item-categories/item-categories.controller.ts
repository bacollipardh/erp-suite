import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ItemCategoriesService } from './item-categories.service';
import { CreateItemCategoryDto } from './dto/createItemCategory.dto';
import { UpdateItemCategoryDto } from './dto/updateItemCategory.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';

@Controller('item-categories')
export class ItemCategoriesController {
  constructor(private readonly service: ItemCategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.itemCategoriesRead)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.itemCategoriesRead)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.itemCategoriesManage)
  create(@Body() dto: CreateItemCategoryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.itemCategoriesManage)
  update(@Param('id') id: string, @Body() dto: UpdateItemCategoryDto) {
    return this.service.update(id, dto);
  }
}
