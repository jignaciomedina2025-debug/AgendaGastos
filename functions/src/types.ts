/**
 * Domain types mirrored for Cloud Functions (Node runtime).
 * Keep in sync with src/types/finance.ts
 */

export type InterestType = "NO_INTEREST" | "WITH_INTEREST";
export type PurchaseStatus = "CONFIRMED" | "PENDING_CONFIRMATION";

export interface UserDoc {
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

export interface PurchaseDoc {
  id: string;
  userId: string;
  title: string;
  cardOrStore: string;
  totalAmount: number;
  installmentsCount: number;
  installmentValue?: number;
  interestType: InterestType;
  status: PurchaseStatus;
  firstBillingMonth: string;
  isShared: boolean;
  splitBetweenUserIds: string[];
  amountPerUser?: number;
  isGift: boolean;
}

export interface MonthlyStatementDoc {
  id: string;
  userId: string;
  monthYear: string;
  totalIndividualDebt: number;
  totalSharedDebt: number;
  grandTotal: number;
  isClosed: boolean;
  closedAt: string;
  createdAt: string;
}
