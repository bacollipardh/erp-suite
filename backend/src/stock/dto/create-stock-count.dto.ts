import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateStockCountDto {
  @IsUUID()
  warehouseId: string;

  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedQty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsOptional()
  @IsDateString()
  countedAt?: string;
}
