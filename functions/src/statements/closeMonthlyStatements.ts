import type { DocumentData, Firestore } from "firebase-admin/firestore";
import type { MonthlyStatementDoc, PurchaseDoc, UserDoc } from "../types";
import {
  getMonthYearFromDate,
  getUserMonthlyShare,
  isMonthInInstallmentWindow,
} from "../utils/billing";

export type CloseMonthlyStatementsResult = {
  monthYear: string;
  processedUsers: number;
  createdStatements: number;
  skippedExisting: number;
  failedUsers: Array<{ userId: string; error: string }>;
};

function mapPurchase(id: string, data: DocumentData): PurchaseDoc {
  return {
    id,
    userId: String(data.userId ?? ""),
    title: String(data.title ?? ""),
    cardOrStore: String(data.cardOrStore ?? ""),
    totalAmount: Number(data.totalAmount ?? 0),
    installmentsCount: Number(data.installmentsCount ?? 0),
    installmentValue:
      typeof data.installmentValue === "number"
        ? data.installmentValue
        : undefined,
    interestType: data.interestType,
    status: data.status,
    firstBillingMonth: String(data.firstBillingMonth ?? ""),
    isShared: Boolean(data.isShared),
    splitBetweenUserIds: Array.isArray(data.splitBetweenUserIds)
      ? data.splitBetweenUserIds.map(String)
      : [],
    amountPerUser:
      typeof data.amountPerUser === "number" ? data.amountPerUser : undefined,
    isGift: Boolean(data.isGift),
  };
}

async function fetchActiveUsers(db: Firestore): Promise<UserDoc[]> {
  const usersRef = db.collection("users");

  // Prefer explicit isActive=true; fall back to all users if none tagged.
  const activeSnap = await usersRef.where("isActive", "==", true).get();
  if (!activeSnap.empty) {
    return activeSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<UserDoc, "id">),
    }));
  }

  const allSnap = await usersRef.get();
  return allSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<UserDoc, "id">),
  }));
}

async function fetchActivePurchasesForMonth(
  db: Firestore,
  monthYear: string,
): Promise<PurchaseDoc[]> {
  const snap = await db
    .collection("purchases")
    .where("firstBillingMonth", "<=", monthYear)
    .get();

  return snap.docs
    .map((doc) => mapPurchase(doc.id, doc.data()))
    .filter((purchase) =>
      isMonthInInstallmentWindow(
        purchase.firstBillingMonth,
        purchase.installmentsCount,
        monthYear,
      ),
    );
}

function buildStatementForUser(
  userId: string,
  monthYear: string,
  purchases: PurchaseDoc[],
  nowIso: string,
): Omit<MonthlyStatementDoc, "id"> {
  let totalIndividualDebt = 0;
  let totalSharedDebt = 0;

  for (const purchase of purchases) {
    const share = getUserMonthlyShare(purchase, userId);
    if (share <= 0) continue;

    if (purchase.isShared) {
      totalSharedDebt += share;
    } else {
      totalIndividualDebt += share;
    }
  }

  const grandTotal = totalIndividualDebt + totalSharedDebt;

  return {
    userId,
    monthYear,
    totalIndividualDebt: roundMoney(totalIndividualDebt),
    totalSharedDebt: roundMoney(totalSharedDebt),
    grandTotal: roundMoney(grandTotal),
    isClosed: true,
    closedAt: nowIso,
    createdAt: nowIso,
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Closes the billing month for every active user.
 * Failures are isolated per user so one bad document cannot abort the batch.
 */
export async function closeMonthlyStatements(
  db: Firestore,
  options?: { referenceDate?: Date },
): Promise<CloseMonthlyStatementsResult> {
  const referenceDate = options?.referenceDate ?? new Date();
  const monthYear = getMonthYearFromDate(referenceDate);
  const nowIso = referenceDate.toISOString();

  const result: CloseMonthlyStatementsResult = {
    monthYear,
    processedUsers: 0,
    createdStatements: 0,
    skippedExisting: 0,
    failedUsers: [],
  };

  const [users, purchases] = await Promise.all([
    fetchActiveUsers(db),
    fetchActivePurchasesForMonth(db, monthYear),
  ]);

  for (const user of users) {
    result.processedUsers += 1;

    try {
      const statementId = `${user.id}_${monthYear}`;
      const statementRef = db.collection("monthly_statements").doc(statementId);
      const existing = await statementRef.get();

      if (existing.exists && existing.data()?.isClosed === true) {
        result.skippedExisting += 1;
        continue;
      }

      const payload = buildStatementForUser(
        user.id,
        monthYear,
        purchases,
        nowIso,
      );

      await statementRef.set(payload, { merge: true });
      result.createdStatements += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown statement error";
      result.failedUsers.push({ userId: user.id, error: message });
      console.error(
        `[closeMonthlyStatements] Failed for user ${user.id}:`,
        message,
      );
    }
  }

  return result;
}
