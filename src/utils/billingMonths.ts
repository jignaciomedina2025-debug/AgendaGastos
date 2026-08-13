/**
 * Month helpers for billing periods in `YYYY-MM` format.
 */

const MONTH_YEAR_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthYear(monthYear: string): boolean {
  return MONTH_YEAR_PATTERN.test(monthYear);
}

/** Parses `YYYY-MM` into calendar year/month (month is 1-12). */
export function parseMonthYear(monthYear: string): { year: number; month: number } {
  if (!isValidMonthYear(monthYear)) {
    throw new Error(`Invalid monthYear format: "${monthYear}". Expected YYYY-MM.`);
  }

  const [year, month] = monthYear.split("-").map(Number);
  return { year, month };
}

export function formatMonthYear(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Adds `offset` months to a `YYYY-MM` string. */
export function addMonths(monthYear: string, offset: number): string {
  const { year, month } = parseMonthYear(monthYear);
  const absolute = year * 12 + (month - 1) + offset;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = (absolute % 12) + 1;
  return formatMonthYear(nextYear, nextMonth);
}

/**
 * Returns true when `targetMonth` falls within the installment window
 * that starts at `firstBillingMonth` and lasts `installmentsCount` months.
 */
export function isMonthInInstallmentWindow(
  firstBillingMonth: string,
  installmentsCount: number,
  targetMonth: string,
): boolean {
  if (installmentsCount < 1) return false;
  if (targetMonth < firstBillingMonth) return false;

  const lastBillingMonth = addMonths(firstBillingMonth, installmentsCount - 1);
  return targetMonth <= lastBillingMonth;
}
