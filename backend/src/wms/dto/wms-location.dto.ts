import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWmsLocationDto {
  @IsUUID()
  warehouseId: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  zone: string;

  @IsOptional()
  @IsString()
  aisle?: string;

  @IsOptional()
  @IsString()
  rack?: string;

  @IsOptional()
  @IsString()
  shelf?: string;

  @IsOptional()
  @IsString()
  bin?: string;

  @IsOptional()
  @IsString()
  locationType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  maxWeight?: number;

  @IsOptional()
  @IsNumber()
  maxVolume?: number;

  @IsOptional()
  @IsNumber()
  maxQty?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWmsLocationDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  aisle?: string;

  @IsOptional()
  @IsString()
  rack?: string;

  @IsOptional()
  @IsString()
  shelf?: string;

  @IsOptional()
  @IsString()
  bin?: string;

  @IsOptional()
  @IsString()
  locationType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  maxWeight?: number;

  @IsOptional()
  @IsNumber()
  maxVolume?: number;

  @IsOptional()
  @IsNumber()
  maxQty?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
