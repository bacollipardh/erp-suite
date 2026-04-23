import {
  FinanceStatementLineDirection,
  FinanceStatementLineStatus,
} from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class BankReconciliationReportQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  financeAccountId?: string;

  @IsOptional()
  @IsEnum(FinanceStatementLineDirection)
  direction?: FinanceStatementLineDirection;

  @IsOptional()
  @IsEnum(FinanceStatementLineStatus)
  status?: FinanceStatementLineStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
