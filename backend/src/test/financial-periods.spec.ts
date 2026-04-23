import { FinancialPeriodStatus } from '@prisma/client';
import {
  buildFinancialPeriodBounds,
  canOverrideFinancialPeriod,
  getFinancialPeriodKey,
  isFinancialPeriodLocked,
} from '../common/utils/financial-periods';

describe('financial period helpers', () => {
  it('builds inclusive monthly bounds in UTC', () => {
    const bounds = buildFinancialPeriodBounds(2026, 2);

    expect(bounds.periodStart.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(bounds.periodEnd.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(getFinancialPeriodKey(2026, 2)).toBe('2026-02');
  });

  it('allows only admin override on locked periods', () => {
    expect(canOverrideFinancialPeriod('ADMIN')).toBe(true);
    expect(canOverrideFinancialPeriod('MANAGER')).toBe(false);
    expect(isFinancialPeriodLocked(FinancialPeriodStatus.OPEN, 'MANAGER')).toBe(false);
    expect(isFinancialPeriodLocked(FinancialPeriodStatus.SOFT_CLOSED, 'MANAGER')).toBe(true);
    expect(isFinancialPeriodLocked(FinancialPeriodStatus.CLOSED, 'ADMIN')).toBe(false);
  });
});
