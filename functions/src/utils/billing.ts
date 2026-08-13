const MONTH_YEAR_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthYear(monthYear: string): boolean {
  return MONTH_YEAR_PATTERN.test(monthYear);
}

export function formatMonthYear(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthYear(monthYear: string): { year: number; month: number } {
  if (!isValidMonthYear(monthYear)) {
    throw new Error(`Invalid monthYear: "${monthYear}"`);
  }
  const [year, month] = monthYear.split("-").map(Number);
  return { year, month };
}

export function addMonths(monthYear: string, offset: number): string {
  const { year, month } = parseMonthYear(monthYear);
  const absolute = year * 12 + (month - 1) + offset;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = (absolute % 12) + 1;
  return formatMonthYear(nextYear, nextMonth);
}

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

/** Current calendar month in `YYYY-MM` for a given Date. */
export function getMonthYearFromDate(date: Date): string {
  return formatMonthYear(date.getFullYear(), date.getMonth() + 1);
}

export function getMonthlyInstallmentAmount(purchase: {
  installmentValue?: number;
  totalAmount: number;
  installmentsCount: number;
}): number {
  if (
    typeof purchase.installmentValue === "number" &&
    Number.isFinite(purchase.installmentValue) &&
    purchase.installmentValue > 0
  ) {
    return purchase.installmentValue;
  }
  if (purchase.installmentsCount < 1) return 0;
  return purchase.totalAmount / purchase.installmentsCount;
}

export function getUserMonthlyShare(
  purchase: {
    userId: string;
    isShared: boolean;
    splitBetweenUserIds: string[];
    installmentValue?: number;
    totalAmount: number;
    installmentsCount: number;
  },
  userId: string,
): number {
  const monthly = getMonthlyInstallmentAmount(purchase);

  if (purchase.isShared) {
    if (!purchase.splitBetweenUserIds.includes(userId)) return 0;
    const participants = purchase.splitBetweenUserIds.length;
    return participants > 0 ? monthly / participants : 0;
  }

  return purchase.userId === userId ? monthly : 0;
}
