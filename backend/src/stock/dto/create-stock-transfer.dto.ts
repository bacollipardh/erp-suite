import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateStockTransferDto {
  @IsUUID()
  fromWarehouseId: string;

  @IsUUID()
  toWarehouseId: string;

  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty: number;

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
  movementAt?: string;
}
