import { CashDailyCloseStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListCashDailyCloseQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  financeAccountId?: string;

  @IsOptional()
  @IsDateString()
  businessDate?: string;

  @IsOptional()
  @IsEnum(CashDailyCloseStatus)
  status?: CashDailyCloseStatus;
}
