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

export class CreateSalesInvoiceLineDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0.001)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number = 0;

  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent: number;
}

export class CreateSalesInvoiceDto {
  @IsUUID()
  seriesId: string;

  @IsUUID()
  customerId: string;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsDateString()
  docDate: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSalesInvoiceLineDto)
  lines: CreateSalesInvoiceLineDto[];
}
