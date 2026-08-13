/**
 * Domain types for the Family Financial Management PWA.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** Household this profile belongs to. */
  familyId: string;
  isActive: boolean;
  createdAt?: Date;
}

export interface Family {
  id: string;
  name: string;
  /** Code other members use to join this household. */
  inviteCode: string;
  createdBy: string;
  createdAt: Date;
}

export type InterestType = "NO_INTEREST" | "WITH_INTEREST";

export type PurchaseStatus = "CONFIRMED" | "PENDING_CONFIRMATION";

export interface Purchase {
  id: string;
  /** User who registered the purchase. */
  userId: string;
  familyId: string;
  title: string;
  /** Card or store used for the purchase. */
  cardOrStore: string;
  totalAmount: number;
  installmentsCount: number;
  /** Exact installment value, or estimated when interest is unknown. */
  installmentValue?: number;
  interestType: InterestType;
  /**
   * Use `PENDING_CONFIRMATION` when `interestType` is `WITH_INTEREST`
   * and the installment value was estimated.
   */
  status: PurchaseStatus;
  purchaseDate: Date;
  /** First billing month in `YYYY-MM` format. */
  firstBillingMonth: string;
  isShared: boolean;
  /** Involved user IDs when `isShared` is true. */
  splitBetweenUserIds: string[];
  /**
   * Denormalized share per participant for efficient reads.
   * Equals `totalAmount / splitBetweenUserIds.length` when shared,
   * otherwise equals `totalAmount`.
   */
  amountPerUser: number;
  /** Gift mode: hide from other household members. */
  isGift: boolean;
  createdAt: Date;
}

export interface MonthlyStatement {
  id: string;
  userId: string;
  /** Statement period in `YYYY-MM` format. */
  monthYear: string;
  totalIndividualDebt: number;
  totalSharedDebt: number;
  grandTotal: number;
  /** Auto-generated on the 3rd day of the month. */
  isClosed: boolean;
  /** ISO timestamp set by the monthly close job. */
  closedAt?: string;
}

/** Purchase payload accepted when creating a new document. */
export type NewPurchaseInput = Omit<Purchase, "id" | "createdAt" | "amountPerUser">;

/**
 * Purchase as returned to the UI after gift-privacy sanitization.
 * Hidden gifts keep enough numeric data for family debt totals
 * without exposing merchant/title details to other users.
 */
export interface SanitizedPurchase extends Purchase {
  /** True when this row was redacted for the current viewer. */
  isHiddenGift: boolean;
}

export interface FamilyPurchasesResult {
  purchases: SanitizedPurchase[];
  /** True when at least one gift was redacted for the current viewer. */
  containsHiddenItems: boolean;
  /**
   * Sum of redacted gifts' `amountPerUser` for the requested billing month,
   * so the UI can include them in family totals without listing item amounts.
   */
  hiddenGiftsContribution: number;
}

export type ServiceSuccess<T> = {
  success: true;
  data: T;
};

export type ServiceFailure = {
  success: false;
  error: string;
};

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;
