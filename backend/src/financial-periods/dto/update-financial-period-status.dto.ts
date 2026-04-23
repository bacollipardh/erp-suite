import { FinancialPeriodStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFinancialPeriodStatusDto {
  @IsEnum(FinancialPeriodStatus)
  status: FinancialPeriodStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
