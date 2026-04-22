import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CreateFinanceAccountDto } from './dto/create-finance-account.dto';
import { CreateFinanceAccountTransactionDto } from './dto/create-finance-account-transaction.dto';
import { CreateFinanceTransferDto } from './dto/create-finance-transfer.dto';
import { ListFinanceAccountsQueryDto } from './dto/list-finance-accounts-query.dto';
import { ListFinanceAccountTransactionsQueryDto } from './dto/list-finance-account-transactions-query.dto';
import { FinanceAccountsService } from './finance-accounts.service';

@ApiTags('finance-accounts')
@ApiBearerAuth()
@Controller('finance-accounts')
export class FinanceAccountsController {
  constructor(private readonly financeAccountsService: FinanceAccountsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.financeAccountsRead)
  findAll(@Query() query: ListFinanceAccountsQueryDto) {
    return this.financeAccountsService.findAll(query);
  }

  @Get('transactions')
  @RequirePermissions(PERMISSIONS.financeAccountsRead)
  findTransactions(@Query() query: ListFinanceAccountTransactionsQueryDto) {
    return this.financeAccountsService.findTransactions(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.financeAccountsManage)
  create(@Body() dto: CreateFinanceAccountDto, @CurrentUser() user: JwtPayload) {
    return this.financeAccountsService.create(dto, user.sub);
  }

  @Post('transactions')
  @RequirePermissions(PERMISSIONS.financeAccountsManage)
  createManualTransaction(
    @Body() dto: CreateFinanceAccountTransactionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeAccountsService.createManualTransaction(dto, user.sub);
  }

  @Post('transfers')
  @RequirePermissions(PERMISSIONS.financeAccountsManage)
  createTransfer(@Body() dto: CreateFinanceTransferDto, @CurrentUser() user: JwtPayload) {
    return this.financeAccountsService.createTransfer(dto, user.sub);
  }
}
