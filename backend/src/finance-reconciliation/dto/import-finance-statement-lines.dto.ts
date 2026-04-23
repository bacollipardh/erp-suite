import { FinanceStatementLineDirection } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class FinanceStatementLineImportRowDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowNo?: number;

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

export class ImportFinanceStatementLinesDto {
  @IsUUID()
  financeAccountId: string;

  @IsOptional()
  @IsBoolean()
  autoMatch?: boolean = true;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => FinanceStatementLineImportRowDto)
  lines: FinanceStatementLineImportRowDto[];
}
