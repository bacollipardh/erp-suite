import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class OpenCashDailyCloseDto {
  @IsUUID()
  financeAccountId: string;

  @IsDateString()
  businessDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @IsOptional()
  @IsString()
  openingNotes?: string;
}
