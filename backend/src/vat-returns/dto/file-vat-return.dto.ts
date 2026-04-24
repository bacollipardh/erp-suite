import { IsDateString, IsOptional, IsString } from 'class-validator';

export class FileVatReturnDto {
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
