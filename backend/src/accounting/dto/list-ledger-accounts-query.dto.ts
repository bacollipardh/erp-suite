import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListLedgerAccountsQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'CONTRA_REVENUE', 'EXPENSE'])
  category?: string;

  @IsOptional()
  @IsIn([
    'CURRENT_ASSET',
    'NON_CURRENT_ASSET',
    'CURRENT_LIABILITY',
    'NON_CURRENT_LIABILITY',
    'EQUITY',
    'REVENUE',
    'CONTRA_REVENUE',
    'COST_OF_SALES',
    'OPERATING_EXPENSE',
    'OTHER_INCOME',
    'OTHER_EXPENSE',
  ])
  reportSection?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  allowManual?: string;
}
