import { PaymentStatus } from '@prisma/client';

export function resolvePaymentStatus(total: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) return PaymentStatus.UNPAID;
  if (amountPaid >= total) return PaymentStatus.PAID;
  return PaymentStatus.PARTIALLY_PAID;
}
