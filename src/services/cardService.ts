import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  Timestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import type { PaymentCard, ServiceResult } from "@/types/finance";

const CARDS_COLLECTION = "cards";

export const CARD_BRAND_PRESETS = [
  "CMR",
  "Ripley",
  "Tricot",
  "Paris",
  "Falabella",
  "Visa",
  "Mastercard",
  "American Express",
  "Mach",
  "Mercado Pago",
  "Banco de Chile",
  "Banco Estado",
  "Santander",
  "Bci",
  "Otra",
] as const;

export function formatCardLabel(card: Pick<PaymentCard, "brand" | "lastFour" | "label">): string {
  const base = `${card.brand} •••• ${card.lastFour}`;
  return card.label?.trim() ? `${card.label.trim()} (${base})` : base;
}

function mapCard(id: string, data: DocumentData): PaymentCard {
  return {
    id,
    familyId: String(data.familyId ?? ""),
    userId: String(data.userId ?? ""),
    brand: String(data.brand ?? ""),
    lastFour: String(data.lastFour ?? ""),
    label: data.label ? String(data.label) : undefined,
    createdAt:
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
  };
}

export async function getFamilyCards(
  familyId: string,
): Promise<ServiceResult<PaymentCard[]>> {
  try {
    if (!familyId.trim()) {
      return { success: false, error: "familyId is required." };
    }

    const snap = await getDocs(
      query(
        collection(getFirestoreDb(), CARDS_COLLECTION),
        where("familyId", "==", familyId),
      ),
    );

    const cards = snap.docs
      .map((item) => mapCard(item.id, item.data()))
      .sort((a, b) => a.brand.localeCompare(b.brand, "es"));

    return { success: true, data: cards };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "No se pudieron cargar las tarjetas.",
    };
  }
}

export type NewCardInput = {
  familyId: string;
  userId: string;
  brand: string;
  lastFour: string;
  label?: string;
};

export async function addCard(
  input: NewCardInput,
): Promise<ServiceResult<PaymentCard>> {
  try {
    const brand = input.brand.trim();
    const lastFour = input.lastFour.replace(/\D/g, "");
    const label = input.label?.trim();

    if (!input.familyId.trim() || !input.userId.trim()) {
      return { success: false, error: "Falta familia o usuario." };
    }
    if (!brand) {
      return { success: false, error: "Elige o escribe el nombre de la tarjeta." };
    }
    if (!/^\d{4}$/.test(lastFour)) {
      return { success: false, error: "Los últimos 4 dígitos deben ser exactamente 4 números." };
    }

    const createdAt = new Date();
    const payload = {
      familyId: input.familyId,
      userId: input.userId,
      brand,
      lastFour,
      label: label || null,
      createdAt: Timestamp.fromDate(createdAt),
    };

    const ref = await addDoc(collection(getFirestoreDb(), CARDS_COLLECTION), payload);

    return {
      success: true,
      data: {
        id: ref.id,
        familyId: input.familyId,
        userId: input.userId,
        brand,
        lastFour,
        label: label || undefined,
        createdAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo guardar la tarjeta.",
    };
  }
}

export async function deleteCard(
  cardId: string,
): Promise<ServiceResult<null>> {
  try {
    if (!cardId.trim()) {
      return { success: false, error: "cardId is required." };
    }
    await deleteDoc(doc(getFirestoreDb(), CARDS_COLLECTION, cardId));
    return { success: true, data: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar la tarjeta.",
    };
  }
}
