import { PaymentStatus } from '@prisma/client';
import { resolvePaymentStatus } from '../common/utils/payments';

describe('resolvePaymentStatus', () => {
  it('returns UNPAID when nothing has been paid', () => {
    expect(resolvePaymentStatus(100, 0)).toBe(PaymentStatus.UNPAID);
  });

  it('returns PARTIALLY_PAID when the amount is between zero and total', () => {
    expect(resolvePaymentStatus(100, 25)).toBe(PaymentStatus.PARTIALLY_PAID);
  });

  it('returns PAID when the full amount has been covered', () => {
    expect(resolvePaymentStatus(100, 100)).toBe(PaymentStatus.PAID);
    expect(resolvePaymentStatus(100, 150)).toBe(PaymentStatus.PAID);
  });
});
