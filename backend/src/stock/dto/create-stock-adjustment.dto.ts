import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, NotEquals } from 'class-validator';

export class CreateStockAdjustmentDto {
  @IsUUID()
  warehouseId: string;

  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsNumber()
  @NotEquals(0)
  qtyChange: number;

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
  reason?: string;

  @IsOptional()
  @IsDateString()
  movementAt?: string;
}
