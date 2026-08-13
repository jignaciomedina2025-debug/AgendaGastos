import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { getFirebaseAuth } from "@/lib/firebase";
import type { Family, ServiceResult, User } from "@/types/finance";
import {
  createUserProfileWithFamily,
  getFamilyById,
  getFamilyMembers,
  getUserProfile,
} from "@/services/userService";

export type AuthSession = {
  firebaseUser: FirebaseUser;
  profile: User;
  family: Family;
  familyMembers: User[];
};

function mapAuthError(error: unknown): string {
  const code =
    error instanceof FirebaseError
      ? error.code
      : error instanceof Error && "code" in error
        ? String((error as { code?: string }).code)
        : "";
  const message =
    error instanceof Error ? error.message : "Error de autenticación.";

  switch (code) {
    case "auth/email-already-in-use":
      return "Ese email ya está registrado. Prueba iniciar sesión.";
    case "auth/invalid-email":
      return "Email inválido.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    case "auth/operation-not-allowed":
      return "Email/contraseña no está habilitado en Firebase Authentication.";
    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado en Firebase Authentication.";
    case "auth/invalid-api-key":
      return "API key de Firebase inválida.";
    case "auth/network-request-failed":
      return "Error de red. Revisa tu conexión o desactiva bloqueadores.";
    default:
      return code ? `${message} [${code}]` : message;
  }
}

export async function registerWithEmail(input: {
  name: string;
  email: string;
  password: string;
  familyName?: string;
  inviteCode?: string;
}): Promise<ServiceResult<AuthSession>> {
  try {
    const credential = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      input.email.trim(),
      input.password,
    );

    await updateProfile(credential.user, { displayName: input.name.trim() });

    const profileResult = await createUserProfileWithFamily({
      uid: credential.user.uid,
      name: input.name,
      email: input.email,
      familyName: input.familyName,
      inviteCode: input.inviteCode,
    });

    if (!profileResult.success) {
      await signOut(getFirebaseAuth());
      return profileResult;
    }

    const membersResult = await getFamilyMembers(profileResult.data.family.id);
    const familyMembers = membersResult.success ? membersResult.data : [profileResult.data.user];

    return {
      success: true,
      data: {
        firebaseUser: credential.user,
        profile: profileResult.data.user,
        family: profileResult.data.family,
        familyMembers,
      },
    };
  } catch (error) {
    return { success: false, error: mapAuthError(error) };
  }
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<ServiceResult<AuthSession>> {
  try {
    const credential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      email.trim(),
      password,
    );

    const session = await loadSession(credential.user);
    if (!session.success) {
      await signOut(getFirebaseAuth());
      return session;
    }

    return session;
  } catch (error) {
    return { success: false, error: mapAuthError(error) };
  }
}

export async function logout(): Promise<ServiceResult<null>> {
  try {
    await signOut(getFirebaseAuth());
    return { success: true, data: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo cerrar sesión.",
    };
  }
}

export async function loadSession(
  firebaseUser: FirebaseUser,
): Promise<ServiceResult<AuthSession>> {
  const profileResult = await getUserProfile(firebaseUser.uid);
  if (!profileResult.success) {
    return {
      success: false,
      error:
        "Tu cuenta no tiene perfil. Regístrate de nuevo o contacta al administrador.",
    };
  }

  const familyResult = await getFamilyById(profileResult.data.familyId);
  if (!familyResult.success) return familyResult;

  const membersResult = await getFamilyMembers(profileResult.data.familyId);
  const familyMembers = membersResult.success
    ? membersResult.data
    : [profileResult.data];

  return {
    success: true,
    data: {
      firebaseUser,
      profile: profileResult.data,
      family: familyResult.data,
      familyMembers,
    },
  };
}

export function subscribeToAuth(
  onChange: (user: FirebaseUser | null) => void,
): () => void {
  return onAuthStateChanged(getFirebaseAuth(), onChange);
}
