import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { ApplyFinanceStatementMatchDto } from './dto/apply-finance-statement-match.dto';
import { CreateFinanceStatementLineDto } from './dto/create-finance-statement-line.dto';
import { ImportFinanceStatementLinesDto } from './dto/import-finance-statement-lines.dto';
import { ListFinanceStatementLinesQueryDto } from './dto/list-finance-statement-lines-query.dto';
import { FinanceReconciliationService } from './finance-reconciliation.service';

@ApiTags('finance-reconciliation')
@ApiBearerAuth()
@Controller('finance-reconciliation')
export class FinanceReconciliationController {
  constructor(private readonly financeReconciliationService: FinanceReconciliationService) {}

  @Get('statement-lines')
  @RequirePermissions(PERMISSIONS.financeAccountsRead)
  listStatementLines(@Query() query: ListFinanceStatementLinesQueryDto) {
    return this.financeReconciliationService.listStatementLines(query);
  }

  @Get('statement-lines/:id/workspace')
  @RequirePermissions(PERMISSIONS.financeAccountsRead)
  getStatementLineWorkspace(@Param('id') id: string) {
    return this.financeReconciliationService.getStatementLineWorkspace(id);
  }

  @Post('statement-lines')
  @RequirePermissions(PERMISSIONS.financeAccountsManage)
  createStatementLine(
    @Body() dto: CreateFinanceStatementLineDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeReconciliationService.createStatementLine(dto, user.sub);
  }

  @Post('statement-lines/import')
  @RequirePermissions(PERMISSIONS.financeAccountsManage)
  importStatementLines(
    @Body() dto: ImportFinanceStatementLinesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeReconciliationService.importStatementLines(dto, user.sub);
  }

  @Post('statement-lines/:id/matches')
  @RequirePermissions(PERMISSIONS.financeAccountsManage)
  createMatch(
    @Param('id') id: string,
    @Body() dto: ApplyFinanceStatementMatchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeReconciliationService.createMatch(id, dto, user.sub);
  }

  @Delete('statement-lines/:id/matches/:matchId')
  @RequirePermissions(PERMISSIONS.financeAccountsManage)
  removeMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeReconciliationService.removeMatch(id, matchId, user.sub);
  }
}
