import { FinanceAccountTransactionType, FinanceAccountType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListFinanceAccountTransactionsQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsEnum(FinanceAccountType)
  accountType?: FinanceAccountType;

  @IsOptional()
  @IsEnum(FinanceAccountTransactionType)
  transactionType?: FinanceAccountTransactionType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
