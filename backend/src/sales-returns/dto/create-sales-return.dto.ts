import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesReturnLineDto {
  @IsUUID()
  salesInvoiceLineId: string;

  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0.001)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent: number;
}

export class CreateSalesReturnDto {
  @IsUUID()
  seriesId: string;

  @IsUUID()
  salesInvoiceId: string;

  @IsUUID()
  customerId: string;

  @IsDateString()
  docDate: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnLineDto)
  lines: CreateSalesReturnLineDto[];
}
