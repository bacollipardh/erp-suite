import { IsUUID } from 'class-validator';

export class VatSettlementPreviewDto {
  @IsUUID()
  financialPeriodId: string;
}
