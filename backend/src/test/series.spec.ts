import { inferNextSeriesNumber } from '../common/utils/series';

describe('inferNextSeriesNumber', () => {
  it('preserves the current next number when there are no documents', () => {
    expect(
      inferNextSeriesNumber({
        prefix: 'FB-',
        currentNextNumber: 4,
        existingDocNos: [],
      }),
    ).toBe(4);
  });

  it('moves the series forward when existing documents are ahead of the stored next number', () => {
    expect(
      inferNextSeriesNumber({
        prefix: 'FB-',
        currentNextNumber: 1,
        existingDocNos: ['FB-000001', 'FB-000002', 'FB-000010'],
      }),
    ).toBe(11);
  });

  it('ignores document numbers from other prefixes or invalid suffixes', () => {
    expect(
      inferNextSeriesNumber({
        prefix: 'KS-',
        currentNextNumber: 2,
        existingDocNos: ['FB-000100', 'KS-ABC', 'KS-000005'],
      }),
    ).toBe(6);
  });
});
