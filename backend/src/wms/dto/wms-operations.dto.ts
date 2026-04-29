import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class WmsReceiveDto {
  @IsUUID()
  locationId: string;

  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsOptional()
  @IsString()
  lotCode?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  manufacturingDate?: string;

  @IsOptional()
  @IsArray()
  serialNumbers?: string[];

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  inventoryStatus?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class WmsMoveDto {
  @IsUUID()
  fromLocationId: string;

  @IsUUID()
  toLocationId: string;

  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsOptional()
  @IsString()
  lotCode?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class WmsPutawayDto extends WmsMoveDto {}

export class WmsReplenishDto extends WmsMoveDto {}

export class WmsCountDto {
  @IsUUID()
  locationId: string;

  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0)
  countedQty: number;

  @IsOptional()
  @IsString()
  lotCode?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class WmsStatusDto {
  @IsUUID()
  locationId: string;

  @IsUUID()
  itemId: string;

  @IsString()
  inventoryStatus: string;

  @IsOptional()
  @IsString()
  lotCode?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class WmsCycleCountPlanDto {
  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class WmsTaskActionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class WmsTaskPickConfirmDto {
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  qty?: number;

  @IsOptional()
  @IsString()
  locationCode?: string;

  @IsOptional()
  @IsString()
  itemCode?: string;

  @IsOptional()
  @IsString()
  lotCode?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
