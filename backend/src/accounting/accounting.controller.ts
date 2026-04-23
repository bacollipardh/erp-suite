import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { AccountingService } from './accounting.service';
import { AccountingReportQueryDto } from './dto/accounting-report-query.dto';
import { ListJournalEntriesQueryDto } from './dto/list-journal-entries-query.dto';
import { ListLedgerAccountsQueryDto } from './dto/list-ledger-accounts-query.dto';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  @RequirePermissions(PERMISSIONS.accountingRead)
  listAccounts(@Query() query: ListLedgerAccountsQueryDto) {
    return this.accountingService.listAccounts(query);
  }

  @Get('journal-entries')
  @RequirePermissions(PERMISSIONS.accountingRead)
  listJournalEntries(@Query() query: ListJournalEntriesQueryDto) {
    return this.accountingService.listJournalEntries(query);
  }

  @Get('trial-balance')
  @RequirePermissions(PERMISSIONS.reportsAccounting)
  getTrialBalance(@Query() query: AccountingReportQueryDto) {
    return this.accountingService.getTrialBalance(query);
  }

  @Get('profit-loss')
  @RequirePermissions(PERMISSIONS.reportsAccounting)
  getProfitAndLoss(@Query() query: AccountingReportQueryDto) {
    return this.accountingService.getProfitAndLoss(query);
  }

  @Get('balance-sheet')
  @RequirePermissions(PERMISSIONS.reportsAccounting)
  getBalanceSheet(@Query() query: AccountingReportQueryDto) {
    return this.accountingService.getBalanceSheet(query);
  }
}
