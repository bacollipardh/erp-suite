import { VatSettlementStatus } from '@prisma/client';
import {
  buildVatSettlementNo,
  resolveVatSettlementStatus,
} from '../vat-settlements/vat-settlements.utils';

describe('vat-settlements utils', () => {
  it('builds a stable settlement number by month', () => {
    expect(buildVatSettlementNo(2026, 4)).toBe('VAT-2026-04');
  });

  it('marks zero settlement as balanced', () => {
    expect(resolveVatSettlementStatus(0, 0, 0)).toBe(VatSettlementStatus.BALANCED);
  });

  it('marks receivable settlement when input VAT is higher', () => {
    expect(resolveVatSettlementStatus(0, 54, 0)).toBe(VatSettlementStatus.REFUND_DUE);
  });

  it('marks partial payment correctly', () => {
    expect(resolveVatSettlementStatus(100, 0, 25)).toBe(
      VatSettlementStatus.PARTIALLY_PAID,
    );
  });

  it('marks full payment correctly', () => {
    expect(resolveVatSettlementStatus(100, 0, 100)).toBe(VatSettlementStatus.PAID);
  });
});
