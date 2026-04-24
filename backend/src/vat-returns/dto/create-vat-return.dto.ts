import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVatReturnDto {
  @IsUUID()
  financialPeriodId: string;

  @IsOptional()
  @IsDateString()
  declarationDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
