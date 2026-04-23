import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVatSettlementDto {
  @IsUUID()
  financialPeriodId: string;

  @IsOptional()
  @IsDateString()
  settlementDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
