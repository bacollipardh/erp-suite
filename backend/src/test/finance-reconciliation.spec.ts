import { FinanceStatementLineStatus } from '@prisma/client';
import {
  calculateStatementRemainingAmount,
  calculateTransactionAvailableAmount,
  resolveStatementLineStatus,
} from '../common/utils/finance-reconciliation';

describe('finance reconciliation helpers', () => {
  it('calculates remaining statement amount without going below zero', () => {
    expect(calculateStatementRemainingAmount(100, 35)).toBe(65);
    expect(calculateStatementRemainingAmount(100, 150)).toBe(0);
  });

  it('calculates available ledger transaction amount without going below zero', () => {
    expect(calculateTransactionAvailableAmount(80, 30)).toBe(50);
    expect(calculateTransactionAvailableAmount(80, 100)).toBe(0);
  });

  it('resolves statement line status from matched amount', () => {
    expect(resolveStatementLineStatus(100, 0)).toBe(FinanceStatementLineStatus.UNMATCHED);
    expect(resolveStatementLineStatus(100, 45)).toBe(
      FinanceStatementLineStatus.PARTIALLY_MATCHED,
    );
    expect(resolveStatementLineStatus(100, 100)).toBe(FinanceStatementLineStatus.MATCHED);
    expect(resolveStatementLineStatus(100, 125)).toBe(FinanceStatementLineStatus.MATCHED);
  });
});
