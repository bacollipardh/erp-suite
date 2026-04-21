import { PaymentStatus } from '@prisma/client';
import {
  calculateOutstandingAmount,
  resolveDueState,
  resolvePaymentStatus,
} from '../common/utils/payments';

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
    expect(resolvePaymentStatus(0, 0)).toBe(PaymentStatus.PAID);
  });

  it('calculates outstanding amount without going below zero', () => {
    expect(calculateOutstandingAmount(100, 25)).toBe(75);
    expect(calculateOutstandingAmount(100, 125)).toBe(0);
  });

  it('marks documents without due date as NO_DUE_DATE when still open', () => {
    expect(
      resolveDueState({
        dueDate: null,
        outstandingAmount: 50,
        paymentStatus: PaymentStatus.UNPAID,
      }),
    ).toEqual({ dueState: 'NO_DUE_DATE', daysPastDue: 0 });
  });

  it('marks documents as CURRENT, DUE_TODAY or OVERDUE based on due date', () => {
    const today = new Date('2026-04-21T10:00:00Z');

    expect(
      resolveDueState({
        dueDate: '2026-04-23',
        outstandingAmount: 50,
        paymentStatus: PaymentStatus.UNPAID,
        today,
      }),
    ).toEqual({ dueState: 'CURRENT', daysPastDue: 0 });

    expect(
      resolveDueState({
        dueDate: '2026-04-21',
        outstandingAmount: 50,
        paymentStatus: PaymentStatus.UNPAID,
        today,
      }),
    ).toEqual({ dueState: 'DUE_TODAY', daysPastDue: 0 });

    expect(
      resolveDueState({
        dueDate: '2026-04-18',
        outstandingAmount: 50,
        paymentStatus: PaymentStatus.PARTIALLY_PAID,
        today,
      }),
    ).toEqual({ dueState: 'OVERDUE', daysPastDue: 3 });
  });

  it('marks fully paid documents as PAID regardless of due date', () => {
    expect(
      resolveDueState({
        dueDate: '2026-04-01',
        outstandingAmount: 0,
        paymentStatus: PaymentStatus.PAID,
        today: new Date('2026-04-21T10:00:00Z'),
      }),
    ).toEqual({ dueState: 'PAID', daysPastDue: 0 });
  });
});
