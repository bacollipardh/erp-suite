import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CreateWmsLocationDto, UpdateWmsLocationDto } from './dto/wms-location.dto';
import {
  WmsCountDto,
  WmsCycleCountPlanDto,
  WmsMoveDto,
  WmsPutawayDto,
  WmsReceiveDto,
  WmsReplenishDto,
  WmsStatusDto,
  WmsTaskActionDto,
  WmsTaskPickConfirmDto,
} from './dto/wms-operations.dto';
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

  @Get('tasks/:id')
  @RequirePermissions(PERMISSIONS.wmsRead)
  findTaskById(@Param('id') id: string) {
    return this.wmsService.findTaskById(id);
  }

  @Get('reservations')
  @RequirePermissions(PERMISSIONS.wmsRead)
  findReservations(@Query() query: WmsQueryDto) {
    return this.wmsService.findReservations(query);
  }

  @Get('expiry')
  @RequirePermissions(PERMISSIONS.wmsRead)
  findExpiry(@Query() query: WmsQueryDto) {
    return this.wmsService.findExpiry(query);
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

  @Post('putaway')
  @RequirePermissions(PERMISSIONS.wmsMove)
  putaway(@Body() dto: WmsPutawayDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.putaway(dto, user.sub);
  }

  @Post('replenish')
  @RequirePermissions(PERMISSIONS.wmsMove)
  replenish(@Body() dto: WmsReplenishDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.replenish(dto, user.sub);
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

  @Post('expiry/mark-expired')
  @RequirePermissions(PERMISSIONS.wmsManage)
  markExpiredStock(@CurrentUser() user: JwtPayload) {
    return this.wmsService.markExpiredStock(user.sub);
  }

  @Post('cycle-counts/plan')
  @RequirePermissions(PERMISSIONS.wmsCount)
  createCycleCountPlan(@Body() dto: WmsCycleCountPlanDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.createCycleCountPlan(dto, user.sub);
  }

  @Post('tasks/:id/start')
  @RequirePermissions(PERMISSIONS.wmsManage)
  startTask(@Param('id') id: string, @Body() dto: WmsTaskActionDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.startTask(id, dto, user.sub);
  }

  @Post('tasks/:id/complete')
  @RequirePermissions(PERMISSIONS.wmsManage)
  completeTask(@Param('id') id: string, @Body() dto: WmsTaskActionDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.completeTask(id, dto, user.sub);
  }

  @Post('tasks/:id/cancel')
  @RequirePermissions(PERMISSIONS.wmsManage)
  cancelTask(@Param('id') id: string, @Body() dto: WmsTaskActionDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.cancelTask(id, dto, user.sub);
  }

  @Post('tasks/:id/short')
  @RequirePermissions(PERMISSIONS.wmsManage)
  shortTask(@Param('id') id: string, @Body() dto: WmsTaskActionDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.shortTask(id, dto, user.sub);
  }

  @Post('tasks/:id/pick-confirm')
  @RequirePermissions(PERMISSIONS.wmsPick)
  confirmPickTask(@Param('id') id: string, @Body() dto: WmsTaskPickConfirmDto, @CurrentUser() user: JwtPayload) {
    return this.wmsService.confirmPickTask(id, dto, user.sub);
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

  @Post('picking/sales-invoices/:id/finalize')
  @RequirePermissions(PERMISSIONS.wmsPick)
  finalizeSalesPick(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.wmsService.finalizeSalesPick(id, user.sub);
  }

  @Post('picking/sales-invoices/:id/release')
  @RequirePermissions(PERMISSIONS.wmsPick)
  releaseSalesPick(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.wmsService.releaseSalesPick(id, user.sub);
  }

  @Post('packing/sales-invoices/:id/pack')
  @RequirePermissions(PERMISSIONS.wmsPick)
  packSalesInvoice(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.wmsService.packSalesInvoice(id, user.sub);
  }
}
