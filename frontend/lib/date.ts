const DATE_PART_PATTERN = /(\d{4})-(\d{2})-(\d{2})/;

function toUtcDate(datePart: string) {
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function extractDatePart(value?: Date | string | number | null) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  const match = raw.match(DATE_PART_PATTERN);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function formatDateOnly(
  value?: Date | string | number | null,
  locale = 'sq-AL',
) {
  const datePart = extractDatePart(value);
  if (!datePart) return '-';

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(toUtcDate(datePart));
}

export function formatDateTime(
  value?: Date | string | number | null,
  locale = 'sq-AL',
) {
  if (!value) return '-';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function toDateInputValue(value?: Date | string | number | null) {
  return extractDatePart(value) ?? '';
}
