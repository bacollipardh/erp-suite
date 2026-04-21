import { BadRequestException, Injectable } from '@nestjs/common';
import { FiscalMode } from '@prisma/client';

export interface FiscalDocumentPayload {
  documentId: string;
  documentType: 'SALES_INVOICE' | 'SALES_RETURN';
  documentNumber: string;
  documentDate: Date;
  totalAmount: number;
  customerName?: string | null;
  companyName: string;
}

export interface FiscalSubmissionResult {
  reference: string;
  submittedAt: string;
  mode: FiscalMode;
}

@Injectable()
export class KosovoFiscalizationAdapter {
  async submit(mode: FiscalMode, payload: FiscalDocumentPayload): Promise<FiscalSubmissionResult> {
    if (mode === FiscalMode.DISABLED) {
      throw new BadRequestException('Fiscalization is disabled in the company profile');
    }

    if (mode === FiscalMode.LIVE) {
      throw new BadRequestException('Live fiscalization adapter is not configured yet');
    }

    return {
      reference: `KS-SBX-${payload.documentNumber}-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      mode,
    };
  }
}
