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

export type PaymentAllocation = {
  enteredAmount: number;
  appliedAmount: number;
  unappliedAmount: number;
  outstandingAmount: number;
};

export function calculatePaymentAllocation(
  enteredAmount: number,
  outstandingAmount: number,
): PaymentAllocation {
  const normalizedEnteredAmount = round2(Math.max(0, Number(enteredAmount ?? 0)));
  const normalizedOutstandingAmount = round2(Math.max(0, Number(outstandingAmount ?? 0)));
  const appliedAmount = round2(
    Math.min(normalizedEnteredAmount, normalizedOutstandingAmount),
  );
  const unappliedAmount = round2(Math.max(0, normalizedEnteredAmount - appliedAmount));

  return {
    enteredAmount: normalizedEnteredAmount,
    appliedAmount,
    unappliedAmount,
    outstandingAmount: normalizedOutstandingAmount,
  };
}

export type PaymentTimelineSourceEntry<TUser = unknown> = {
  id: string;
  createdAt: Date;
  metadata?: unknown;
  user?: TUser | null;
};

export type PaymentTimelineEntry<TUser = unknown> = {
  id: string;
  sequence: number;
  createdAt: Date;
  amount: number;
  enteredAmount: number;
  appliedAmount: number;
  unappliedAmount: number;
  allowUnapplied: boolean;
  paidAt: string;
  referenceNo: string | null;
  notes: string | null;
  amountPaidBefore: number;
  amountPaidAfter: number;
  outstandingBefore: number;
  outstandingAfter: number;
  remainingAmount: number;
  paymentStatusBefore: PaymentStatus;
  paymentStatusAfter: PaymentStatus;
  settlementTotal: number;
  usedFallbackSnapshot: boolean;
  user?: TUser | null;
};

type PaymentAuditMetadata = {
  amount: number;
  enteredAmount: number | null;
  appliedAmount: number | null;
  unappliedAmount: number | null;
  allowUnapplied: boolean;
  paidAt: string;
  referenceNo: string | null;
  notes: string | null;
  amountPaidBefore: number | null;
  amountPaidAfter: number | null;
  outstandingBefore: number | null;
  outstandingAfter: number | null;
  remainingAmount: number | null;
  paymentStatusBefore: PaymentStatus | null;
  paymentStatusAfter: PaymentStatus | null;
  settlementTotal: number | null;
};

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? round2(parsed) : null;
}

function parseOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parsePaymentStatus(value: unknown) {
  if (typeof value !== 'string') return null;
  return Object.values(PaymentStatus).includes(value as PaymentStatus)
    ? (value as PaymentStatus)
    : null;
}

function normalizePaidAt(value: unknown, createdAt: Date) {
  const fallback = createdAt.toISOString();

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  }

  return fallback;
}

export function parsePaymentAuditMetadata(entry: { metadata?: unknown; createdAt: Date }): PaymentAuditMetadata {
  const metadata =
    entry.metadata && typeof entry.metadata === 'object'
      ? (entry.metadata as Record<string, unknown>)
      : {};

  return {
    amount: round2(Number(metadata.amount ?? 0)),
    enteredAmount: parseOptionalNumber(metadata.enteredAmount),
    appliedAmount: parseOptionalNumber(metadata.appliedAmount),
    unappliedAmount: parseOptionalNumber(metadata.unappliedAmount),
    allowUnapplied: metadata.allowUnapplied === true,
    paidAt: normalizePaidAt(metadata.paidAt, entry.createdAt),
    referenceNo: parseOptionalString(metadata.referenceNo),
    notes: parseOptionalString(metadata.notes),
    amountPaidBefore: parseOptionalNumber(metadata.amountPaidBefore),
    amountPaidAfter: parseOptionalNumber(metadata.amountPaidAfter),
    outstandingBefore: parseOptionalNumber(metadata.outstandingBefore),
    outstandingAfter: parseOptionalNumber(metadata.outstandingAfter),
    remainingAmount: parseOptionalNumber(metadata.remainingAmount),
    paymentStatusBefore: parsePaymentStatus(metadata.paymentStatusBefore),
    paymentStatusAfter: parsePaymentStatus(metadata.paymentStatusAfter),
    settlementTotal: parseOptionalNumber(metadata.settlementTotal),
  };
}

export function buildPaymentTimeline<TUser = unknown>(params: {
  entries: PaymentTimelineSourceEntry<TUser>[];
  settlementTotal: number;
}) {
  const baseSettlementTotal = round2(Number(params.settlementTotal ?? 0));
  let runningPaid = 0;

  return [...params.entries]
    .map((entry) => ({
      entry,
      metadata: parsePaymentAuditMetadata(entry),
    }))
    .sort((left, right) => {
      const paidAtDifference =
        new Date(left.metadata.paidAt).getTime() - new Date(right.metadata.paidAt).getTime();

      if (paidAtDifference !== 0) return paidAtDifference;

      return left.entry.createdAt.getTime() - right.entry.createdAt.getTime();
    })
    .map(({ entry, metadata }, index) => {
      const settlementTotal = metadata.settlementTotal ?? baseSettlementTotal;
      const appliedAmount = metadata.appliedAmount ?? metadata.amount;
      const enteredAmount = metadata.enteredAmount ?? appliedAmount;
      const unappliedAmount = metadata.unappliedAmount ?? round2(Math.max(0, enteredAmount - appliedAmount));
      const amountPaidBefore = metadata.amountPaidBefore ?? runningPaid;
      const amountPaidAfter = metadata.amountPaidAfter ?? round2(amountPaidBefore + appliedAmount);
      const outstandingBefore =
        metadata.outstandingBefore ??
        calculateOutstandingAmount(settlementTotal, amountPaidBefore);
      const outstandingAfter =
        metadata.outstandingAfter ??
        metadata.remainingAmount ??
        calculateOutstandingAmount(settlementTotal, amountPaidAfter);
      const paymentStatusBefore =
        metadata.paymentStatusBefore ?? resolvePaymentStatus(settlementTotal, amountPaidBefore);
      const paymentStatusAfter =
        metadata.paymentStatusAfter ?? resolvePaymentStatus(settlementTotal, amountPaidAfter);
      const usedFallbackSnapshot =
        metadata.amountPaidBefore === null ||
        metadata.amountPaidAfter === null ||
        metadata.outstandingBefore === null ||
        (metadata.outstandingAfter === null && metadata.remainingAmount === null) ||
        metadata.paymentStatusBefore === null ||
        metadata.paymentStatusAfter === null ||
        metadata.settlementTotal === null;

      runningPaid = amountPaidAfter;

      return {
        id: entry.id,
        sequence: index + 1,
        createdAt: entry.createdAt,
        amount: appliedAmount,
        enteredAmount,
        appliedAmount,
        unappliedAmount,
        allowUnapplied: metadata.allowUnapplied,
        paidAt: metadata.paidAt,
        referenceNo: metadata.referenceNo,
        notes: metadata.notes,
        amountPaidBefore,
        amountPaidAfter,
        outstandingBefore,
        outstandingAfter,
        remainingAmount: outstandingAfter,
        paymentStatusBefore,
        paymentStatusAfter,
        settlementTotal,
        usedFallbackSnapshot,
        user: entry.user ?? null,
      } satisfies PaymentTimelineEntry<TUser>;
    });
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
