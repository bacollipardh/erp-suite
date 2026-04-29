import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class PostSalesInvoiceDto {
  @IsOptional()
  @IsBoolean()
  skipWms?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  skipWmsReason?: string;
}
