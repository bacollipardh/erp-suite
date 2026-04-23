import {
  calculateNetBySide,
  calculateStatementAmount,
  isBalanceSheetSection,
  isProfitLossSection,
} from '../accounting/accounting.utils';

describe('Accounting utils', () => {
  it('treats assets as debit-normal in statements', () => {
    expect(
      calculateStatementAmount({
        reportSection: 'CURRENT_ASSET',
        debit: 150,
        credit: 25,
      } as any),
    ).toBe(125);
  });

  it('treats liabilities as credit-normal in statements', () => {
    expect(
      calculateStatementAmount({
        reportSection: 'CURRENT_LIABILITY',
        debit: 10,
        credit: 90,
      } as any),
    ).toBe(80);
  });

  it('splits debit and credit balances correctly', () => {
    expect(calculateNetBySide({ debit: 200, credit: 50 })).toEqual(
      expect.objectContaining({
        net: 150,
        debitBalance: 150,
        creditBalance: 0,
      }),
    );
    expect(calculateNetBySide({ debit: 40, credit: 100 })).toEqual(
      expect.objectContaining({
        net: -60,
        debitBalance: 0,
        creditBalance: 60,
      }),
    );
  });

  it('distinguishes balance sheet and profit/loss sections', () => {
    expect(isBalanceSheetSection('EQUITY' as any)).toBe(true);
    expect(isBalanceSheetSection('REVENUE' as any)).toBe(false);
    expect(isProfitLossSection('OTHER_EXPENSE' as any)).toBe(true);
  });
});
