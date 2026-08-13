import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Family, ServiceResult, User } from "@/types/finance";

const USERS_COLLECTION = "users";
const FAMILIES_COLLECTION = "families";

function mapUser(id: string, data: DocumentData): User {
  return {
    id,
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    avatarUrl: data.avatarUrl,
    familyId: String(data.familyId ?? ""),
    isActive: data.isActive !== false,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
  };
}

function mapFamily(id: string, data: DocumentData): Family {
  return {
    id,
    name: String(data.name ?? "Familia"),
    inviteCode: String(data.inviteCode ?? ""),
    createdBy: String(data.createdBy ?? ""),
    createdAt:
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
  };
}

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function getUserProfile(userId: string): Promise<ServiceResult<User>> {
  try {
    const snap = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (!snap.exists()) {
      return { success: false, error: "Perfil no encontrado." };
    }
    return { success: true, data: mapUser(snap.id, snap.data()) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo cargar el perfil.",
    };
  }
}

export async function getFamilyById(familyId: string): Promise<ServiceResult<Family>> {
  try {
    const snap = await getDoc(doc(db, FAMILIES_COLLECTION, familyId));
    if (!snap.exists()) {
      return { success: false, error: "Familia no encontrada." };
    }
    return { success: true, data: mapFamily(snap.id, snap.data()) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo cargar la familia.",
    };
  }
}

export async function findFamilyByInviteCode(
  inviteCode: string,
): Promise<ServiceResult<Family>> {
  try {
    const normalized = inviteCode.trim().toUpperCase();
    if (!normalized) {
      return { success: false, error: "Ingresa un código de familia." };
    }

    const snap = await getDocs(
      query(
        collection(db, FAMILIES_COLLECTION),
        where("inviteCode", "==", normalized),
      ),
    );

    if (snap.empty) {
      return { success: false, error: "Código de familia inválido." };
    }

    const familyDoc = snap.docs[0];
    return { success: true, data: mapFamily(familyDoc.id, familyDoc.data()) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "No se pudo validar el código.",
    };
  }
}

export async function getFamilyMembers(
  familyId: string,
): Promise<ServiceResult<User[]>> {
  try {
    if (!familyId) {
      return { success: false, error: "familyId is required." };
    }

    const snap = await getDocs(
      query(collection(db, USERS_COLLECTION), where("familyId", "==", familyId)),
    );

    const members = snap.docs
      .map((item) => mapUser(item.id, item.data()))
      .filter((member) => member.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    return { success: true, data: members };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "No se pudieron cargar los miembros.",
    };
  }
}

export type CreateProfileInput = {
  uid: string;
  name: string;
  email: string;
  familyName?: string;
  inviteCode?: string;
};

/**
 * Creates the Firestore profile and either starts a new family
 * or joins an existing one via invite code.
 */
export async function createUserProfileWithFamily(
  input: CreateProfileInput,
): Promise<ServiceResult<{ user: User; family: Family }>> {
  try {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();

    if (!name || !email) {
      return { success: false, error: "Nombre y email son obligatorios." };
    }

    let family: Family;
    const now = Timestamp.now();

    if (input.inviteCode?.trim()) {
      const found = await findFamilyByInviteCode(input.inviteCode);
      if (!found.success) return found;
      family = found.data;
    } else {
      const familyRef = doc(collection(db, FAMILIES_COLLECTION));
      const inviteCode = generateInviteCode();
      const familyPayload = {
        name: (input.familyName?.trim() || `Familia de ${name}`).slice(0, 80),
        inviteCode,
        createdBy: input.uid,
        createdAt: now,
      };
      await setDoc(familyRef, familyPayload);
      family = mapFamily(familyRef.id, familyPayload);
    }

    const userPayload = {
      name,
      email,
      familyId: family.id,
      isActive: true,
      createdAt: now,
    };

    await setDoc(doc(db, USERS_COLLECTION, input.uid), userPayload, {
      merge: true,
    });

    const user = mapUser(input.uid, userPayload);
    return { success: true, data: { user, family } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "No se pudo crear el perfil.",
    };
  }
}
