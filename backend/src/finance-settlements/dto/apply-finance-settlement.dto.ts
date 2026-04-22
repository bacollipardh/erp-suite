import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ApplyFinanceSettlementDto {
  @IsString()
  targetDocumentId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsDateString()
  allocatedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
