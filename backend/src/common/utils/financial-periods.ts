import { BadRequestException } from '@nestjs/common';
import { FinancialPeriodStatus } from '@prisma/client';

export function normalizeFinancialDate(value?: string | Date | null) {
  if (!value) {
    return new Date();
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid financial period date');
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function buildFinancialPeriodBounds(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new BadRequestException('Year must be between 2000 and 2100');
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new BadRequestException('Month must be between 1 and 12');
  }

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));

  return { periodStart, periodEnd };
}

export function getFinancialPeriodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatFinancialPeriodLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('sq-AL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function canOverrideFinancialPeriod(role?: string | null) {
  return role === 'ADMIN';
}

export function isFinancialPeriodLocked(
  status: FinancialPeriodStatus,
  role?: string | null,
) {
  if (status === FinancialPeriodStatus.OPEN) {
    return false;
  }

  return !canOverrideFinancialPeriod(role);
}
