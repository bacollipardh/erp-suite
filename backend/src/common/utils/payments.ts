import { PaymentStatus } from '@prisma/client';
import { round2 } from './money';

export function resolvePaymentStatus(total: number, amountPaid: number): PaymentStatus {
  if (total <= 0) return PaymentStatus.PAID;
  if (amountPaid <= 0) return PaymentStatus.UNPAID;
  if (amountPaid >= total) return PaymentStatus.PAID;
  return PaymentStatus.PARTIALLY_PAID;
}

export type DueState = 'PAID' | 'NO_DUE_DATE' | 'CURRENT' | 'DUE_TODAY' | 'OVERDUE';

function startOfDay(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function calculateOutstandingAmount(total: number, amountPaid: number) {
  return round2(Math.max(0, Number(total ?? 0) - Number(amountPaid ?? 0)));
}

export function resolveDueState(params: {
  dueDate?: Date | string | null;
  outstandingAmount: number;
  paymentStatus?: PaymentStatus | null;
  today?: Date;
}) {
  const today = startOfDay(params.today ?? new Date());
  const outstandingAmount = Number(params.outstandingAmount ?? 0);

  if (params.paymentStatus === PaymentStatus.PAID || outstandingAmount <= 0) {
    return { dueState: 'PAID' as DueState, daysPastDue: 0 };
  }

  if (!params.dueDate) {
    return { dueState: 'NO_DUE_DATE' as DueState, daysPastDue: 0 };
  }

  const dueDate = startOfDay(new Date(params.dueDate));
  const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return { dueState: 'CURRENT' as DueState, daysPastDue: 0 };
  }

  if (diffDays === 0) {
    return { dueState: 'DUE_TODAY' as DueState, daysPastDue: 0 };
  }

  return { dueState: 'OVERDUE' as DueState, daysPastDue: diffDays };
}
