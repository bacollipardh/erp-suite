import { Type } from 'class-transformer';
import {
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

export class CustomerReceiptAllocationDto {
  @IsUUID()
  salesInvoiceId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class CreateCustomerReceiptDto {
  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @IsUUID()
  customerId: string;

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
  @ValidateNested({ each: true })
  @Type(() => CustomerReceiptAllocationDto)
  allocations?: CustomerReceiptAllocationDto[];
}
