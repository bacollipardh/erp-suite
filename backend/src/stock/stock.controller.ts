import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockBalanceQueryDto } from './dto/stock-balance-query.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { CreateStockCountDto } from './dto/create-stock-count.dto';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('balance')
  @RequirePermissions(PERMISSIONS.stockRead)
  findBalances(@Query() query: StockBalanceQueryDto) {
    return this.stockService.findBalances(query);
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.stockRead)
  findMovements(@Query() query: StockMovementQueryDto) {
    return this.stockService.findMovements(query);
  }

  @Post('adjustments')
  @RequirePermissions(PERMISSIONS.stockAdjust)
  createAdjustment(
    @Body() dto: CreateStockAdjustmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.stockService.createAdjustment(dto, user.sub);
  }

  @Post('transfers')
  @RequirePermissions(PERMISSIONS.stockTransfer)
  createTransfer(@Body() dto: CreateStockTransferDto, @CurrentUser() user: JwtPayload) {
    return this.stockService.createTransfer(dto, user.sub);
  }

  @Post('counts')
  @RequirePermissions(PERMISSIONS.stockAdjust)
  createCount(@Body() dto: CreateStockCountDto, @CurrentUser() user: JwtPayload) {
    return this.stockService.createCount(dto, user.sub);
  }
}
