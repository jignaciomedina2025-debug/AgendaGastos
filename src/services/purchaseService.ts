import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import type {
  FamilyPurchasesResult,
  NewPurchaseInput,
  Purchase,
  PurchaseStatus,
  SanitizedPurchase,
  ServiceResult,
} from "@/types/finance";
import {
  isMonthInInstallmentWindow,
  isValidMonthYear,
} from "@/utils/billingMonths";

const PURCHASES_COLLECTION = "purchases";

/** Payload accepted by `addPurchase` (amountPerUser is computed in the service). */
export type AddPurchaseInput = NewPurchaseInput;

function resolvePurchaseStatus(input: AddPurchaseInput): PurchaseStatus {
  const hasExactInstallment =
    typeof input.installmentValue === "number" &&
    Number.isFinite(input.installmentValue);

  if (input.interestType === "WITH_INTEREST" && !hasExactInstallment) {
    return "PENDING_CONFIRMATION";
  }

  return input.status ?? "CONFIRMED";
}

/**
 * Denormalizes the per-user share at write time so dashboards
 * can read debt without recomputing splits on every query.
 */
export function calculateAmountPerUser(
  totalAmount: number,
  isShared: boolean,
  splitBetweenUserIds: string[],
): number {
  if (!isShared) {
    return totalAmount;
  }

  const participants = splitBetweenUserIds.length;
  if (participants < 2) {
    throw new Error(
      "Shared purchases require at least 2 user IDs in splitBetweenUserIds.",
    );
  }

  return totalAmount / participants;
}

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  throw new Error("Invalid date value in purchase document.");
}

function mapPurchaseDoc(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): Purchase {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    userId: data.userId,
    familyId: String(data.familyId ?? ""),
    title: data.title,
    cardOrStore: data.cardOrStore,
    cardId: data.cardId ? String(data.cardId) : undefined,
    totalAmount: data.totalAmount,
    installmentsCount: data.installmentsCount,
    installmentValue: data.installmentValue,
    interestType: data.interestType,
    status: data.status,
    purchaseDate: toDate(data.purchaseDate),
    firstBillingMonth: data.firstBillingMonth,
    isShared: Boolean(data.isShared),
    splitBetweenUserIds: data.splitBetweenUserIds ?? [],
    amountPerUser:
      typeof data.amountPerUser === "number"
        ? data.amountPerUser
        : calculateAmountPerUser(
            data.totalAmount,
            Boolean(data.isShared),
            data.splitBetweenUserIds ?? [],
          ),
    isGift: Boolean(data.isGift),
    createdAt: toDate(data.createdAt),
  };
}

/**
 * Gift privacy: other household members must not see title/merchant,
 * but family totals still need a numeric contribution.
 */
function sanitizePurchaseForViewer(
  purchase: Purchase,
  currentUserId: string,
): SanitizedPurchase {
  const isHiddenGift = purchase.isGift && purchase.userId !== currentUserId;

  if (!isHiddenGift) {
    return { ...purchase, isHiddenGift: false };
  }

  return {
    ...purchase,
    title: "Compra Oculta",
    cardOrStore: "Oculto",
    // Keep amountPerUser for debt math; hide raw item total from non-owners.
    totalAmount: purchase.amountPerUser,
    installmentValue: undefined,
    isHiddenGift: true,
  };
}

/**
 * Creates a purchase document.
 * Forces PENDING_CONFIRMATION when interest exists without an exact cuota.
 * Stores `amountPerUser` denormalized for efficient family reads.
 */
export async function addPurchase(
  purchaseData: AddPurchaseInput,
): Promise<ServiceResult<Purchase>> {
  try {
    if (!purchaseData.userId?.trim()) {
      return { success: false, error: "userId is required." };
    }
    if (!purchaseData.familyId?.trim()) {
      return { success: false, error: "familyId is required." };
    }
    if (!purchaseData.title?.trim()) {
      return { success: false, error: "title is required." };
    }
    if (!isValidMonthYear(purchaseData.firstBillingMonth)) {
      return {
        success: false,
        error: 'firstBillingMonth must use "YYYY-MM" format.',
      };
    }
    if (purchaseData.totalAmount < 0 || purchaseData.installmentsCount < 1) {
      return {
        success: false,
        error: "totalAmount must be >= 0 and installmentsCount must be >= 1.",
      };
    }
    if (purchaseData.isShared && purchaseData.splitBetweenUserIds.length < 2) {
      return {
        success: false,
        error: "Shared purchases need at least two splitBetweenUserIds.",
      };
    }

    const status = resolvePurchaseStatus(purchaseData);
    const amountPerUser = calculateAmountPerUser(
      purchaseData.totalAmount,
      purchaseData.isShared,
      purchaseData.splitBetweenUserIds,
    );
    const createdAt = new Date();

    const payload = {
      userId: purchaseData.userId,
      familyId: purchaseData.familyId,
      title: purchaseData.title.trim(),
      cardOrStore: purchaseData.cardOrStore.trim(),
      cardId: purchaseData.cardId ?? null,
      totalAmount: purchaseData.totalAmount,
      installmentsCount: purchaseData.installmentsCount,
      installmentValue: purchaseData.installmentValue,
      interestType: purchaseData.interestType,
      status,
      purchaseDate: Timestamp.fromDate(purchaseData.purchaseDate),
      firstBillingMonth: purchaseData.firstBillingMonth,
      isShared: purchaseData.isShared,
      splitBetweenUserIds: purchaseData.isShared
        ? purchaseData.splitBetweenUserIds
        : [],
      amountPerUser,
      isGift: purchaseData.isGift,
      createdAt: Timestamp.fromDate(createdAt),
    };

    const docRef = await addDoc(collection(getFirestoreDb(), PURCHASES_COLLECTION), payload);

    const purchase: Purchase = {
      id: docRef.id,
      ...purchaseData,
      splitBetweenUserIds: payload.splitBetweenUserIds,
      status,
      amountPerUser,
      createdAt,
    };

    return { success: true, data: purchase };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create purchase.";
    return { success: false, error: message };
  }
}

export type UpdatedInstallment = Pick<
  Purchase,
  "id" | "installmentValue" | "totalAmount" | "amountPerUser" | "status"
>;

/**
 * Confirms a purchase once the real billed installment (and optional total) is known.
 */
export async function updatePurchaseInstallment(
  purchaseId: string,
  newInstallmentValue: number,
  totalBilledAmount?: number,
): Promise<ServiceResult<UpdatedInstallment>> {
  try {
    if (!purchaseId?.trim()) {
      return { success: false, error: "purchaseId is required." };
    }
    if (!Number.isFinite(newInstallmentValue) || newInstallmentValue < 0) {
      return {
        success: false,
        error: "newInstallmentValue must be a non-negative number.",
      };
    }
    if (
      totalBilledAmount !== undefined &&
      (!Number.isFinite(totalBilledAmount) || totalBilledAmount < 0)
    ) {
      return {
        success: false,
        error: "totalBilledAmount must be a non-negative number when provided.",
      };
    }

    const purchaseRef = doc(getFirestoreDb(), PURCHASES_COLLECTION, purchaseId);
    const currentSnap = await getDoc(purchaseRef);

    if (!currentSnap.exists()) {
      return { success: false, error: `Purchase "${purchaseId}" was not found.` };
    }

    const current = mapPurchaseDoc(
      currentSnap as QueryDocumentSnapshot<DocumentData>,
    );

    const nextTotalAmount =
      totalBilledAmount !== undefined ? totalBilledAmount : current.totalAmount;

    const amountPerUser = calculateAmountPerUser(
      nextTotalAmount,
      current.isShared,
      current.splitBetweenUserIds,
    );

    const updates = {
      installmentValue: newInstallmentValue,
      totalAmount: nextTotalAmount,
      amountPerUser,
      status: "CONFIRMED" as const,
    };

    await updateDoc(purchaseRef, updates);

    return {
      success: true,
      data: {
        id: purchaseId,
        installmentValue: updates.installmentValue,
        totalAmount: updates.totalAmount,
        amountPerUser: updates.amountPerUser,
        status: updates.status,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update purchase installment.";
    return { success: false, error: message };
  }
}

/**
 * Returns family purchases active in `monthYear`, applying gift privacy sanitization.
 */
export async function getFamilyPurchases(
  currentUserId: string,
  monthYear: string,
  familyId: string,
): Promise<ServiceResult<FamilyPurchasesResult>> {
  try {
    if (!currentUserId?.trim()) {
      return { success: false, error: "currentUserId is required." };
    }
    if (!familyId?.trim()) {
      return { success: false, error: "familyId is required." };
    }
    if (!isValidMonthYear(monthYear)) {
      return {
        success: false,
        error: 'monthYear must use "YYYY-MM" format.',
      };
    }

    // Scoped to household; installment window filtered in memory.
    const purchasesQuery = query(
      collection(getFirestoreDb(), PURCHASES_COLLECTION),
      where("familyId", "==", familyId),
      where("firstBillingMonth", "<=", monthYear),
    );

    const snapshot = await getDocs(purchasesQuery);
    const activePurchases = snapshot.docs
      .map(mapPurchaseDoc)
      .filter((purchase) =>
        isMonthInInstallmentWindow(
          purchase.firstBillingMonth,
          purchase.installmentsCount,
          monthYear,
        ),
      );

    let containsHiddenItems = false;
    let hiddenGiftsContribution = 0;

    const purchases = activePurchases.map((purchase) => {
      const sanitized = sanitizePurchaseForViewer(purchase, currentUserId);

      if (sanitized.isHiddenGift) {
        containsHiddenItems = true;
        hiddenGiftsContribution += sanitized.amountPerUser;
      }

      return sanitized;
    });

    return {
      success: true,
      data: {
        purchases,
        containsHiddenItems,
        hiddenGiftsContribution,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch family purchases.";
    return { success: false, error: message };
  }
}
