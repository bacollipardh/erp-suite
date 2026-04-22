import { FinanceSettlementStatus } from '@prisma/client';
import {
  calculateFinanceSettlementRemainingAmount,
  resolveFinanceSettlementStatus,
} from '../common/utils/finance-settlements';

describe('finance settlement helpers', () => {
  it('calculates remaining unapplied balance without going below zero', () => {
    expect(calculateFinanceSettlementRemainingAmount(25, 10)).toBe(15);
    expect(calculateFinanceSettlementRemainingAmount(25, 30)).toBe(0);
  });

  it('resolves settlement status based on allocated amount', () => {
    expect(resolveFinanceSettlementStatus(25, 0)).toBe(FinanceSettlementStatus.OPEN);
    expect(resolveFinanceSettlementStatus(25, 10)).toBe(
      FinanceSettlementStatus.PARTIALLY_ALLOCATED,
    );
    expect(resolveFinanceSettlementStatus(25, 25)).toBe(
      FinanceSettlementStatus.FULLY_ALLOCATED,
    );
  });
});
