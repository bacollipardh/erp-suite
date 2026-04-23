import { FinanceStatementLineDirection } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFinanceStatementLineDto {
  @IsUUID()
  financeAccountId: string;

  @IsEnum(FinanceStatementLineDirection)
  direction: FinanceStatementLineDirection;

  @IsDateString()
  statementDate: string;

  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  statementBalance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  counterpartyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
