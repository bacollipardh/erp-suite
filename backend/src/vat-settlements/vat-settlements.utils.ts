import { VatSettlementStatus } from '@prisma/client';
import { round2 } from '../common/utils/money';

export function buildVatSettlementNo(year: number, month: number) {
  return `VAT-${year}-${String(month).padStart(2, '0')}`;
}

export function resolveVatSettlementStatus(
  payableAmount: number,
  receivableAmount: number,
  paidAmount = 0,
) {
  const payable = round2(payableAmount);
  const receivable = round2(receivableAmount);
  const paid = round2(paidAmount);

  if (payable <= 0 && receivable <= 0) {
    return VatSettlementStatus.BALANCED;
  }

  if (receivable > 0) {
    return VatSettlementStatus.REFUND_DUE;
  }

  if (paid >= payable && payable > 0) {
    return VatSettlementStatus.PAID;
  }

  if (paid > 0) {
    return VatSettlementStatus.PARTIALLY_PAID;
  }

  return VatSettlementStatus.SETTLED;
}
