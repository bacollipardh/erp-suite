import { VatReturnStatus } from '@prisma/client';
import { round2 } from '../common/utils/money';

export function buildVatReturnNo(year: number, month: number) {
  return `VAT-RETURN-${year}-${String(month).padStart(2, '0')}`;
}

export function resolveVatReturnStatus(filedAt?: Date | string | null) {
  return filedAt ? VatReturnStatus.FILED : VatReturnStatus.READY;
}

export function buildVatReturnBoxes(params: {
  outputTaxableBase: number;
  outputVat: number;
  inputTaxableBase: number;
  inputVat: number;
  manualOutputVat: number;
  manualInputVat: number;
  payableAmount: number;
  receivableAmount: number;
  paidAmount: number;
}) {
  const remainingPayableAmount = round2(
    Math.max(round2(params.payableAmount) - round2(params.paidAmount), 0),
  );

  return [
    {
      code: 'S1',
      label: 'Baza tatimore e shitjeve',
      value: round2(params.outputTaxableBase),
    },
    {
      code: 'S2',
      label: 'TVSH ne dalje',
      value: round2(params.outputVat),
    },
    {
      code: 'B1',
      label: 'Baza tatimore e blerjeve',
      value: round2(params.inputTaxableBase),
    },
    {
      code: 'B2',
      label: 'TVSH e zbritshme',
      value: round2(params.inputVat),
    },
    {
      code: 'A1',
      label: 'Rregullime manuale TVSH dalje',
      value: round2(params.manualOutputVat),
    },
    {
      code: 'A2',
      label: 'Rregullime manuale TVSH hyrje',
      value: round2(params.manualInputVat),
    },
    {
      code: 'N1',
      label: 'TVSH neto per pagese',
      value: round2(params.payableAmount),
    },
    {
      code: 'N2',
      label: 'TVSH neto per rimbursim',
      value: round2(params.receivableAmount),
    },
    {
      code: 'N3',
      label: 'Pagesa TVSH te regjistruara',
      value: round2(params.paidAmount),
    },
    {
      code: 'N4',
      label: 'Detyrim i pambuluar',
      value: remainingPayableAmount,
    },
  ];
}

export function buildVatReturnExportBaseName(returnNo: string) {
  return `deklarata-tvsh-${returnNo.toLowerCase()}`;
}
