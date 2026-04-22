import { FinanceAccountType } from '@prisma/client';
import { IsBooleanString, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListFinanceAccountsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(FinanceAccountType)
  accountType?: FinanceAccountType;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
