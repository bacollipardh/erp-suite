import { IsBoolean, IsOptional } from 'class-validator';

export class PostSalesInvoiceDto {
  @IsOptional()
  @IsBoolean()
  skipWms?: boolean;
}
