import { FinanceAccountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFinanceAccountDto {
  @IsString()
  @MaxLength(30)
  code: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsEnum(FinanceAccountType)
  accountType: FinanceAccountType;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankAccountNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  swiftCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @IsOptional()
  @IsDateString()
  openingDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
