import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CreateVatReturnDto } from './dto/create-vat-return.dto';
import { FileVatReturnDto } from './dto/file-vat-return.dto';
import { ListVatReturnsQueryDto } from './dto/list-vat-returns-query.dto';
import { VatReturnPreviewDto } from './dto/vat-return-preview.dto';
import { VatReturnsService } from './vat-returns.service';

@ApiTags('vat-returns')
@ApiBearerAuth()
@Controller('vat-returns')
export class VatReturnsController {
  constructor(private readonly vatReturnsService: VatReturnsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.accountingRead)
  findAll(@Query() query: ListVatReturnsQueryDto) {
    return this.vatReturnsService.findAll(query);
  }

  @Get('preview')
  @RequirePermissions(PERMISSIONS.accountingRead)
  getPreview(@Query() query: VatReturnPreviewDto) {
    return this.vatReturnsService.getPreview(query.financialPeriodId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.accountingRead)
  getOne(@Param('id') id: string) {
    return this.vatReturnsService.getOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.accountingManage)
  createOrUpdate(@Body() dto: CreateVatReturnDto, @CurrentUser() user: JwtPayload) {
    return this.vatReturnsService.createOrUpdate(dto, user.sub);
  }

  @Patch(':id/file')
  @RequirePermissions(PERMISSIONS.accountingManage)
  fileReturn(
    @Param('id') id: string,
    @Body() dto: FileVatReturnDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.vatReturnsService.fileReturn(id, dto, user.sub);
  }

  @Get(':id/export/csv')
  @RequirePermissions(PERMISSIONS.accountingRead)
  async exportCsv(@Param('id') id: string, @Res() res: Response) {
    const exported = await this.vatReturnsService.buildCsvExport(id);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exported.filename}"`,
    });
    res.send(`\uFEFF${exported.content}`);
  }

  @Get(':id/export/json')
  @RequirePermissions(PERMISSIONS.accountingRead)
  async exportJson(@Param('id') id: string, @Res() res: Response) {
    const exported = await this.vatReturnsService.buildJsonExport(id);
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exported.filename}"`,
    });
    res.send(exported.content);
  }

  @Get(':id/export/pdf')
  @RequirePermissions(PERMISSIONS.pdfRead)
  async exportPdf(
    @Param('id') id: string,
    @Query('mode') mode: string,
    @Res() res: Response,
  ) {
    const exported = await this.vatReturnsService.buildPdfExport(id);
    const disposition = mode === 'preview' ? 'inline' : 'attachment';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${exported.filename}"`,
      'Content-Length': exported.buffer.length,
    });
    res.end(exported.buffer);
  }
}
