import { FiscalMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertCompanyProfileDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional() @IsString() @MaxLength(50)  fiscalNo?: string;
  @IsOptional() @IsString() @MaxLength(50)  vatNo?: string;
  @IsOptional() @IsString() @MaxLength(50)  businessNo?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(50)  phone?: string;
  @IsOptional() @IsString() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @IsOptional() @IsString() @MaxLength(50)  bankAccount?: string;
  @IsOptional() @IsEnum(FiscalMode) fiscalMode?: FiscalMode;
  @IsOptional() @IsString() @MaxLength(50)  fiscalBusinessUnit?: string;
  @IsOptional() @IsString() @MaxLength(50)  fiscalOperatorCode?: string;
  @IsOptional() @IsString() @MaxLength(100) fiscalDeviceId?: string;
}
