import { FinanceStatementLineStatus } from '@prisma/client';
import { round2 } from './money';

export function calculateStatementRemainingAmount(
  statementAmount: number,
  matchedAmount: number,
) {
  return round2(Math.max(0, Number(statementAmount ?? 0) - Number(matchedAmount ?? 0)));
}

export function calculateTransactionAvailableAmount(
  transactionAmount: number,
  matchedAmount: number,
) {
  return round2(Math.max(0, Number(transactionAmount ?? 0) - Number(matchedAmount ?? 0)));
}

export function resolveStatementLineStatus(
  statementAmount: number,
  matchedAmount: number,
) {
  const total = round2(Number(statementAmount ?? 0));
  const matched = round2(Number(matchedAmount ?? 0));

  if (matched <= 0) {
    return FinanceStatementLineStatus.UNMATCHED;
  }

  if (matched < total) {
    return FinanceStatementLineStatus.PARTIALLY_MATCHED;
  }

  return FinanceStatementLineStatus.MATCHED;
}
