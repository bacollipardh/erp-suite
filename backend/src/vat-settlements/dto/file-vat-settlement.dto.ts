import { IsDateString, IsOptional, IsString } from 'class-validator';

export class FileVatSettlementDto {
  @IsOptional()
  @IsDateString()
  filedAt?: string;

  @IsOptional()
  @IsString()
  filingReferenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
