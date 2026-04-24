import { IsUUID } from 'class-validator';

export class VatReturnPreviewDto {
  @IsUUID()
  financialPeriodId: string;
}
