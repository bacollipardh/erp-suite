import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CreateWmsLocationDto, UpdateWmsLocationDto } from './dto/wms-location.dto';
import { WmsCountDto, WmsMoveDto, WmsReceiveDto, WmsStatusDto } from './dto/wms-operations.dto';
import { WmsQueryDto } from './dto/wms-query.dto';
import { WmsService } from './wms.service';

@Controller('wms')
export class WmsController {
  constructor(private readonly wmsService: WmsService) {}

  @Get('locations')
  @RequirePermissions(PERMISSIONS.wmsRead)
  findLocations(@Query() query: WmsQueryDto) {
    return this.wmsService.findLocations(query);
  }

  @Post('locations')
  @RequirePermissions(PERMISSIONS.wmsManage)
  createLocation(@Body() dto: CreateWmsLocationDto) {
    return this.wmsService.createLocation(dto);
  }

  @Patch('locations/:id')
  @RequirePermissions(PERMISSIONS.wmsManage)
  updateLocation(@Param('id') id: string, @Body() dto: UpdateWmsLocationDto) {
    return this.wmsService.updateLocation(id, dto);
  }

  @Get('balances')
  @RequirePermissions(PERMISSIONS.wmsRead)
  findBalances(@Query() query: WmsQueryDto) {
    return this.wmsService.findBalances(query);
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.wmsRead)
  findMovements(@Query() query: WmsQueryDto) {
    return this.wmsService.findMovements(query);
  }

  @Get('tasks')
  @RequirePermissions(PERMISSIONS.wmsRead)
  findTasks(@Query() query: WmsQueryDto) {
    return this.wmsService.findTasks(query);
  }

  @Get('scan')
  @RequirePermissions(PERMISSIONS.wmsRead)
  scan(@Query('code') code: string) {
    return this.wmsService.scan(code);
  }

  @Post('receive')
  @RequirePermissions(PERMISSIONS.wmsReceive)
  receive(@Body() dto: WmsReceiveDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.receive(dto, user.sub);
  }

  @Post('move')
  @RequirePermissions(PERMISSIONS.wmsMove)
  move(@Body() dto: WmsMoveDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.move(dto, user.sub);
  }

  @Post('count')
  @RequirePermissions(PERMISSIONS.wmsCount)
  count(@Body() dto: WmsCountDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.count(dto, user.sub);
  }

  @Post('status')
  @RequirePermissions(PERMISSIONS.wmsManage)
  changeInventoryStatus(@Body() dto: WmsStatusDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.changeInventoryStatus(dto, user.sub);
  }

  @Post('picking/sales-invoices/:id/plan')
  @RequirePermissions(PERMISSIONS.wmsPick)
  planSalesPick(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.wmsService.planSalesPick(id, user.sub);
  }

  @Post('picking/sales-invoices/:id/confirm')
  @RequirePermissions(PERMISSIONS.wmsPick)
  confirmSalesPick(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.wmsService.confirmSalesPick(id, user.sub);
  }

  @Post('picking/sales-invoices/:id/release')
  @RequirePermissions(PERMISSIONS.wmsPick)
  releaseSalesPick(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.wmsService.releaseSalesPick(id, user.sub);
  }
}
