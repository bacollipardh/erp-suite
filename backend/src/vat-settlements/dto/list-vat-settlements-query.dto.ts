import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { VatSettlementStatus } from '@prisma/client';

export class ListVatSettlementsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsEnum(VatSettlementStatus)
  status?: VatSettlementStatus;
}
