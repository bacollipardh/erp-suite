import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFinanceAccountTransactionDto {
  @IsUUID()
  financeAccountId: string;

  @IsIn(['IN', 'OUT'])
  direction: 'IN' | 'OUT';

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  counterpartyName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
