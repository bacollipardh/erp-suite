import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignAgentOrderDto {
  @IsUUID()
  assignedPickerId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAgentSalesInvoiceDto {
  @IsUUID()
  seriesId: string;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsDateString()
  docDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAgentSalesReturnDto {
  @IsUUID()
  seriesId: string;

  @IsOptional()
  @IsDateString()
  docDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
