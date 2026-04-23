import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateManualJournalEntryLineDto {
  @IsUUID()
  accountId: string;

  @IsIn(['DEBIT', 'CREDIT'])
  side: 'DEBIT' | 'CREDIT';

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  partyName?: string;
}

export class CreateManualJournalEntryDto {
  @IsDateString()
  entryDate: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  sourceNo?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateManualJournalEntryLineDto)
  lines: CreateManualJournalEntryLineDto[];
}
