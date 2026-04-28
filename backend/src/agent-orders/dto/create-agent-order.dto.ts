import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AgentOrderType } from '@prisma/client';

export class CreateAgentOrderLineDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsUUID()
  salesInvoiceLineId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number = 0;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAgentOrderDto {
  @IsEnum(AgentOrderType)
  orderType: AgentOrderType;

  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsUUID()
  customerObjectId?: string;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsUUID()
  sourceSalesInvoiceId?: string;

  @IsDateString()
  docDate: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number = 5;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAgentOrderLineDto)
  lines: CreateAgentOrderLineDto[];
}
