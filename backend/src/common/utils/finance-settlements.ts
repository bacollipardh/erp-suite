import { FinanceSettlementStatus } from '@prisma/client';
import { round2 } from './money';

export function calculateFinanceSettlementRemainingAmount(
  unappliedAmount: number,
  allocatedAmount: number,
) {
  return round2(Math.max(0, Number(unappliedAmount ?? 0) - Number(allocatedAmount ?? 0)));
}

export function resolveFinanceSettlementStatus(
  unappliedAmount: number,
  allocatedAmount: number,
) {
  const remainingAmount = calculateFinanceSettlementRemainingAmount(
    unappliedAmount,
    allocatedAmount,
  );
  const normalizedUnappliedAmount = round2(Math.max(0, Number(unappliedAmount ?? 0)));

  if (remainingAmount <= 0 || normalizedUnappliedAmount <= 0) {
    return FinanceSettlementStatus.FULLY_ALLOCATED;
  }

  if (allocatedAmount > 0) {
    return FinanceSettlementStatus.PARTIALLY_ALLOCATED;
  }

  return FinanceSettlementStatus.OPEN;
}
