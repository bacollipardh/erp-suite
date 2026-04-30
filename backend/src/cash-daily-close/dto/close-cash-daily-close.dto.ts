import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseCashDailyCloseDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedCashAmount: number;

  @IsOptional()
  @IsString()
  closingNotes?: string;
}
