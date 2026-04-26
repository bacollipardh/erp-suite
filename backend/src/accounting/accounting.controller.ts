import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { AccountingService } from './accounting.service';
import { AccountingReportQueryDto } from './dto/accounting-report-query.dto';
import { ClosingEntryDto } from './dto/closing-entry.dto';
import { CreateManualJournalEntryDto } from './dto/create-manual-journal-entry.dto';
import { ListJournalEntriesQueryDto } from './dto/list-journal-entries-query.dto';
import { ListLedgerAccountsQueryDto } from './dto/list-ledger-accounts-query.dto';
import { VatLedgerQueryDto } from './dto/vat-ledger-query.dto';
import { ManualJournalApprovalGateService } from './manual-journal-approval-gate.service';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly manualJournalApprovalGateService: ManualJournalApprovalGateService,
  ) {}

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

  @Post('journal-entries')
  @RequirePermissions(PERMISSIONS.accountingManage)
  async createManualJournalEntry(
    @Body() dto: CreateManualJournalEntryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.manualJournalApprovalGateService.assertCreateAllowed(dto, user.sub);
    const entry = await this.accountingService.createManualJournalEntry(dto, user.sub);
    await this.manualJournalApprovalGateService.markConsumed(dto.sourceNo, entry.id);
    return entry;
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

  @Get('vat-ledger')
  @RequirePermissions(PERMISSIONS.reportsAccounting)
  getVatLedger(@Query() query: VatLedgerQueryDto) {
    return this.accountingService.getVatLedger(query);
  }

  @Get('closing-entry-preview')
  @RequirePermissions(PERMISSIONS.accountingManage)
  getClosingEntryPreview(@Query() query: ClosingEntryDto) {
    return this.accountingService.getClosingEntryPreview(query.financialPeriodId);
  }

  @Post('closing-entries')
  @RequirePermissions(PERMISSIONS.accountingManage)
  createClosingEntry(@Body() dto: ClosingEntryDto, @CurrentUser() user: JwtPayload) {
    return this.accountingService.createClosingEntry(dto, user.sub);
  }
}
