import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CashDailyCloseService } from './cash-daily-close.service';
import { CloseCashDailyCloseDto } from './dto/close-cash-daily-close.dto';
import { ListCashDailyCloseQueryDto } from './dto/list-cash-daily-close-query.dto';
import { OpenCashDailyCloseDto } from './dto/open-cash-daily-close.dto';

@ApiTags('cash-daily-close')
@ApiBearerAuth()
@Controller('cash-daily-close')
export class CashDailyCloseController {
  constructor(private readonly cashDailyCloseService: CashDailyCloseService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.financeAccountsRead)
  findAll(@Query() query: ListCashDailyCloseQueryDto) {
    return this.cashDailyCloseService.findAll(query);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.financeAccountsRead)
  summary(@Query('date') date?: string) {
    return this.cashDailyCloseService.summary(date);
  }

  @Post('open')
  @RequirePermissions(PERMISSIONS.financeAccountsManage)
  open(@Body() dto: OpenCashDailyCloseDto, @CurrentUser() user: JwtPayload) {
    return this.cashDailyCloseService.open(dto, user.sub);
  }

  @Post(':id/close')
  @RequirePermissions(PERMISSIONS.financeAccountsManage)
  close(
    @Param('id') id: string,
    @Body() dto: CloseCashDailyCloseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.cashDailyCloseService.close(id, dto, user.sub);
  }
}
