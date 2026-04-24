import { VatReturnStatus } from '@prisma/client';
import {
  buildVatReturnBoxes,
  buildVatReturnNo,
  resolveVatReturnStatus,
} from '../vat-returns/vat-returns.utils';

describe('vat-returns utils', () => {
  it('builds a stable return number by month', () => {
    expect(buildVatReturnNo(2026, 4)).toBe('VAT-RETURN-2026-04');
  });

  it('marks return as ready when not filed', () => {
    expect(resolveVatReturnStatus(null)).toBe(VatReturnStatus.READY);
  });

  it('marks return as filed when filedAt exists', () => {
    expect(resolveVatReturnStatus('2026-04-23')).toBe(VatReturnStatus.FILED);
  });

  it('builds declaration boxes with remaining payable amount', () => {
    const boxes = buildVatReturnBoxes({
      outputTaxableBase: 1000,
      outputVat: 180,
      inputTaxableBase: 500,
      inputVat: 90,
      manualOutputVat: 10,
      manualInputVat: 5,
      payableAmount: 95,
      receivableAmount: 0,
      paidAmount: 20,
    });

    expect(boxes).toHaveLength(10);
    expect(boxes.find((box) => box.code === 'N1')?.value).toBe(95);
    expect(boxes.find((box) => box.code === 'N4')?.value).toBe(75);
  });
});
