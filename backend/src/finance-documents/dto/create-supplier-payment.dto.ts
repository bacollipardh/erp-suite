import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SupplierPaymentAllocationDto {
  @IsUUID()
  purchaseInvoiceId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class CreateSupplierPaymentDto {
  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @IsUUID()
  supplierId: string;

  @IsUUID()
  financeAccountId: string;

  @IsDateString()
  docDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplierPaymentAllocationDto)
  allocations?: SupplierPaymentAllocationDto[];
}
