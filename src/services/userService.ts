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
import { getFirestoreDb } from "@/lib/firebase";
import type { Family, ServiceResult, User } from "@/types/finance";

const USERS_COLLECTION = "users";
const FAMILIES_COLLECTION = "families";
const INVITES_COLLECTION = "family_invites";

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
    const snap = await getDoc(doc(getFirestoreDb(), USERS_COLLECTION, userId));
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
    const snap = await getDoc(doc(getFirestoreDb(), FAMILIES_COLLECTION, familyId));
    if (!snap.exists()) {
      return { success: false, error: "Familia no encontrada." };
    }
    const family = mapFamily(snap.id, snap.data());
    await ensureFamilyInvite(family);
    return { success: true, data: family };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo cargar la familia.",
    };
  }
}

/**
 * Invite lookup by document ID = code (no collection scan).
 */
export async function findFamilyByInviteCode(
  inviteCode: string,
): Promise<ServiceResult<Family>> {
  try {
    const normalized = inviteCode.trim().toUpperCase();
    if (!normalized) {
      return { success: false, error: "Ingresa un código de familia." };
    }

    const inviteSnap = await getDoc(
      doc(getFirestoreDb(), INVITES_COLLECTION, normalized),
    );

    if (!inviteSnap.exists()) {
      return { success: false, error: "Código de familia inválido." };
    }

    const invite = inviteSnap.data();
    const familyId = String(invite.familyId ?? "");
    if (!familyId) {
      return { success: false, error: "Código de familia inválido." };
    }

    return {
      success: true,
      data: {
        id: familyId,
        name: String(invite.familyName ?? "Familia"),
        inviteCode: normalized,
        createdBy: String(invite.createdBy ?? ""),
        createdAt:
          invite.createdAt instanceof Timestamp
            ? invite.createdAt.toDate()
            : new Date(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "No se pudo validar el código.",
    };
  }
}

/** Creates invite doc for older families that predate this security model. */
export async function ensureFamilyInvite(family: Family): Promise<void> {
  if (!family.inviteCode || !family.id) return;

  const inviteRef = doc(getFirestoreDb(), INVITES_COLLECTION, family.inviteCode);
  const existing = await getDoc(inviteRef);
  if (existing.exists()) return;

  // Only the creator can create the invite doc under current rules.
  try {
    await setDoc(inviteRef, {
      familyId: family.id,
      familyName: family.name,
      inviteCode: family.inviteCode,
      createdBy: family.createdBy,
      createdAt: Timestamp.now(),
    });
  } catch {
    // Non-creators may not have permission; join still works if invite exists.
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
      query(
        collection(getFirestoreDb(), USERS_COLLECTION),
        where("familyId", "==", familyId),
      ),
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
    let joinedWithCode: string | undefined;
    const now = Timestamp.now();

    if (input.inviteCode?.trim()) {
      const found = await findFamilyByInviteCode(input.inviteCode);
      if (!found.success) return found;
      family = found.data;
      joinedWithCode = family.inviteCode;
    } else {
      const familyRef = doc(collection(getFirestoreDb(), FAMILIES_COLLECTION));
      const inviteCode = generateInviteCode();
      const familyPayload = {
        name: (input.familyName?.trim() || `Familia de ${name}`).slice(0, 80),
        inviteCode,
        createdBy: input.uid,
        createdAt: now,
      };
      await setDoc(familyRef, familyPayload);

      await setDoc(doc(getFirestoreDb(), INVITES_COLLECTION, inviteCode), {
        familyId: familyRef.id,
        familyName: familyPayload.name,
        inviteCode,
        createdBy: input.uid,
        createdAt: now,
      });

      family = mapFamily(familyRef.id, familyPayload);
    }

    const userPayload: Record<string, unknown> = {
      name,
      email,
      familyId: family.id,
      isActive: true,
      createdAt: now,
    };

    if (joinedWithCode) {
      userPayload.joinedWithCode = joinedWithCode;
    }

    await setDoc(doc(getFirestoreDb(), USERS_COLLECTION, input.uid), userPayload, {
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
