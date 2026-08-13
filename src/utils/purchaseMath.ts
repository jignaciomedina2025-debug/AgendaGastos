import type { Purchase } from "@/types/finance";
import { parseMonthYear } from "@/utils/billingMonths";

/** 1-based installment index for `monthYear` within a purchase window. */
export function getInstallmentNumber(
  firstBillingMonth: string,
  monthYear: string,
): number {
  const start = parseMonthYear(firstBillingMonth);
  const target = parseMonthYear(monthYear);
  const startAbsolute = start.year * 12 + (start.month - 1);
  const targetAbsolute = target.year * 12 + (target.month - 1);
  return targetAbsolute - startAbsolute + 1;
}

/** Full monthly installment for a purchase (family / card totals). */
export function getMonthlyInstallmentAmount(purchase: Purchase): number {
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

/**
 * Amount the given user owes this billing month for one purchase.
 * Shared purchases split the monthly cuota equally among participants.
 */
export function getUserMonthlyShare(purchase: Purchase, userId: string): number {
  const monthly = getMonthlyInstallmentAmount(purchase);

  if (purchase.isShared) {
    if (!purchase.splitBetweenUserIds.includes(userId)) return 0;
    const participants = purchase.splitBetweenUserIds.length;
    return participants > 0 ? monthly / participants : 0;
  }

  return purchase.userId === userId ? monthly : 0;
}

export function isPurchaseRelevantToUser(
  purchase: Purchase,
  userId: string,
): boolean {
  if (purchase.isShared) {
    return purchase.splitBetweenUserIds.includes(userId);
  }
  return purchase.userId === userId;
}
