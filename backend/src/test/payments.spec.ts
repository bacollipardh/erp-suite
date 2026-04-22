import { PaymentStatus } from '@prisma/client';
import {
  buildPaymentTimeline,
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

  it('builds a chronological payment timeline with before and after snapshots', () => {
    const timeline = buildPaymentTimeline({
      settlementTotal: 100,
      entries: [
        {
          id: 'payment-2',
          createdAt: new Date('2026-04-21T12:00:00Z'),
          metadata: {
            amount: 40,
            paidAt: '2026-04-21',
            settlementTotal: 100,
            amountPaidBefore: 20,
            amountPaidAfter: 60,
            outstandingBefore: 80,
            outstandingAfter: 40,
            paymentStatusBefore: PaymentStatus.PARTIALLY_PAID,
            paymentStatusAfter: PaymentStatus.PARTIALLY_PAID,
          },
        },
        {
          id: 'payment-1',
          createdAt: new Date('2026-04-20T12:00:00Z'),
          metadata: {
            amount: 20,
            paidAt: '2026-04-20',
            settlementTotal: 100,
            amountPaidBefore: 0,
            amountPaidAfter: 20,
            outstandingBefore: 100,
            outstandingAfter: 80,
            paymentStatusBefore: PaymentStatus.UNPAID,
            paymentStatusAfter: PaymentStatus.PARTIALLY_PAID,
          },
        },
      ],
    });

    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({
      id: 'payment-1',
      sequence: 1,
      amountPaidBefore: 0,
      amountPaidAfter: 20,
      outstandingBefore: 100,
      outstandingAfter: 80,
      paymentStatusBefore: PaymentStatus.UNPAID,
      paymentStatusAfter: PaymentStatus.PARTIALLY_PAID,
      usedFallbackSnapshot: false,
    });
    expect(timeline[1]).toMatchObject({
      id: 'payment-2',
      sequence: 2,
      amountPaidBefore: 20,
      amountPaidAfter: 60,
      outstandingBefore: 80,
      outstandingAfter: 40,
      paymentStatusBefore: PaymentStatus.PARTIALLY_PAID,
      paymentStatusAfter: PaymentStatus.PARTIALLY_PAID,
      usedFallbackSnapshot: false,
    });
  });

  it('falls back to derived reconciliation snapshots for legacy payment entries', () => {
    const timeline = buildPaymentTimeline({
      settlementTotal: 100,
      entries: [
        {
          id: 'legacy-payment',
          createdAt: new Date('2026-04-20T10:00:00Z'),
          metadata: {
            amount: 35,
            paidAt: '2026-04-20',
          },
        },
      ],
    });

    expect(timeline[0]).toMatchObject({
      id: 'legacy-payment',
      sequence: 1,
      amountPaidBefore: 0,
      amountPaidAfter: 35,
      outstandingBefore: 100,
      outstandingAfter: 65,
      paymentStatusBefore: PaymentStatus.UNPAID,
      paymentStatusAfter: PaymentStatus.PARTIALLY_PAID,
      usedFallbackSnapshot: true,
    });
  });
});
