export function buildDocNo(prefix: string, nextNumber: number) {
  return `${prefix}${String(nextNumber).padStart(6, '0')}`;
}

export function inferNextSeriesNumber(params: {
  prefix: string;
  currentNextNumber?: number | null;
  existingDocNos: string[];
}) {
  const highestDocNumber = params.existingDocNos.reduce((max, docNo) => {
    if (!docNo.startsWith(params.prefix)) {
      return max;
    }

    const numericPart = Number.parseInt(docNo.slice(params.prefix.length), 10);
    if (Number.isNaN(numericPart)) {
      return max;
    }

    return Math.max(max, numericPart);
  }, 0);

  return Math.max(params.currentNextNumber ?? 1, highestDocNumber + 1, 1);
}
