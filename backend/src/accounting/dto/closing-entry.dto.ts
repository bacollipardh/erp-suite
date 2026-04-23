import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ClosingEntryDto {
  @IsUUID()
  financialPeriodId: string;

  @IsOptional()
  @IsString()
  description?: string;
}
