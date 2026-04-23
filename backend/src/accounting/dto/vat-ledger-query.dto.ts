import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class VatLedgerQueryDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['ALL', 'INPUT', 'OUTPUT'])
  side?: 'ALL' | 'INPUT' | 'OUTPUT';
}
