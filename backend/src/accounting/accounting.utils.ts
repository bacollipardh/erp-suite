import {
  JournalEntryLineSide,
  LedgerAccountCategory,
  LedgerAccountReportSection,
} from '@prisma/client';
import { round2 } from '../common/utils/money';

const CREDIT_NORMAL_SECTIONS = new Set<LedgerAccountReportSection>([
  LedgerAccountReportSection.CURRENT_LIABILITY,
  LedgerAccountReportSection.NON_CURRENT_LIABILITY,
  LedgerAccountReportSection.EQUITY,
  LedgerAccountReportSection.REVENUE,
  LedgerAccountReportSection.OTHER_INCOME,
]);

const DEBIT_NORMAL_SECTIONS = new Set<LedgerAccountReportSection>([
  LedgerAccountReportSection.CURRENT_ASSET,
  LedgerAccountReportSection.NON_CURRENT_ASSET,
  LedgerAccountReportSection.CONTRA_REVENUE,
  LedgerAccountReportSection.COST_OF_SALES,
  LedgerAccountReportSection.OPERATING_EXPENSE,
  LedgerAccountReportSection.OTHER_EXPENSE,
]);

export function isCreditNormalSection(section: LedgerAccountReportSection) {
  return CREDIT_NORMAL_SECTIONS.has(section);
}

export function isBalanceSheetSection(section: LedgerAccountReportSection) {
  return (
    section === LedgerAccountReportSection.CURRENT_ASSET ||
    section === LedgerAccountReportSection.NON_CURRENT_ASSET ||
    section === LedgerAccountReportSection.CURRENT_LIABILITY ||
    section === LedgerAccountReportSection.NON_CURRENT_LIABILITY ||
    section === LedgerAccountReportSection.EQUITY
  );
}

export function isProfitLossSection(section: LedgerAccountReportSection) {
  return !isBalanceSheetSection(section);
}

export function calculateNetBySide(params: { debit: number; credit: number }) {
  const debit = round2(params.debit);
  const credit = round2(params.credit);
  const net = round2(debit - credit);

  return {
    debit,
    credit,
    net,
    debitBalance: net > 0 ? round2(net) : 0,
    creditBalance: net < 0 ? round2(Math.abs(net)) : 0,
  };
}

export function calculateStatementAmount(params: {
  reportSection: LedgerAccountReportSection;
  debit: number;
  credit: number;
}) {
  const debit = round2(params.debit);
  const credit = round2(params.credit);

  if (isCreditNormalSection(params.reportSection)) {
    return round2(credit - debit);
  }

  if (DEBIT_NORMAL_SECTIONS.has(params.reportSection)) {
    return round2(debit - credit);
  }

  return round2(debit - credit);
}

export function normalSideForCategory(category: LedgerAccountCategory) {
  return category === LedgerAccountCategory.LIABILITY ||
    category === LedgerAccountCategory.EQUITY ||
    category === LedgerAccountCategory.REVENUE
    ? JournalEntryLineSide.CREDIT
    : JournalEntryLineSide.DEBIT;
}
