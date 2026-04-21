import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { DocumentSeriesService } from './document-series.service';
import { CreateDocumentSeriesDto } from './dto/createDocumentSeries.dto';
import { UpdateDocumentSeriesDto } from './dto/updateDocumentSeries.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';

@Controller('document-series')
export class DocumentSeriesController {
  constructor(private readonly service: DocumentSeriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.documentSeriesRead)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.documentSeriesRead)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.documentSeriesManage)
  create(@Body() dto: CreateDocumentSeriesDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.documentSeriesManage)
  update(@Param('id') id: string, @Body() dto: UpdateDocumentSeriesDto) {
    return this.service.update(id, dto);
  }
}
