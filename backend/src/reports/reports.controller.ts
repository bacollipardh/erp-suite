import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { PaymentActivityQueryDto } from './dto/payment-activity-query.dto';
import { BankReconciliationReportQueryDto } from './dto/bank-reconciliation-report-query.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-summary')
  @RequirePermissions(PERMISSIONS.reportsSales)
  getSalesSummary(@Query() query: SalesReportQueryDto) {
    return this.reportsService.getSalesSummary(query);
  }

  @Get('receivables-aging')
  @RequirePermissions(PERMISSIONS.reportsReceivables)
  getReceivablesAging(@Query() query: AgingReportQueryDto) {
    return this.reportsService.getReceivablesAging(query);
  }

  @Get('receivables-exposure')
  @RequirePermissions(PERMISSIONS.reportsReceivables)
  getReceivablesExposure(@Query() query: AgingReportQueryDto) {
    return this.reportsService.getReceivablesExposure(query);
  }

  @Get('payables-aging')
  @RequirePermissions(PERMISSIONS.reportsPayables)
  getPayablesAging(@Query() query: AgingReportQueryDto) {
    return this.reportsService.getPayablesAging(query);
  }

  @Get('payables-exposure')
  @RequirePermissions(PERMISSIONS.reportsPayables)
  getPayablesExposure(@Query() query: AgingReportQueryDto) {
    return this.reportsService.getPayablesExposure(query);
  }

  @Get('receipts-activity')
  @RequirePermissions(PERMISSIONS.reportsReceivables)
  getReceiptsActivity(@Query() query: PaymentActivityQueryDto) {
    return this.reportsService.getReceiptsActivity(query);
  }

  @Get('supplier-payments-activity')
  @RequirePermissions(PERMISSIONS.reportsPayables)
  getSupplierPaymentsActivity(@Query() query: PaymentActivityQueryDto) {
    return this.reportsService.getSupplierPaymentsActivity(query);
  }

  @Get('bank-reconciliation')
  @RequirePermissions(PERMISSIONS.financeAccountsRead)
  getBankReconciliationReport(@Query() query: BankReconciliationReportQueryDto) {
    return this.reportsService.getBankReconciliationReport(query);
  }
}
