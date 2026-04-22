import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AgingReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsIn(['ALL', 'UNPAID', 'PARTIALLY_PAID'])
  paymentStatus?: string;

  @IsOptional()
  @IsIn(['ALL', 'CURRENT', 'DUE_TODAY', 'OVERDUE', 'NO_DUE_DATE'])
  dueState?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOutstanding?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999999999)
  maxOutstanding?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
