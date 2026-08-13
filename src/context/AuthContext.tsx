"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  loadSession,
  loginWithEmail,
  logout as logoutRequest,
  registerWithEmail,
  subscribeToAuth,
  type AuthSession,
} from "@/services/authService";
import { getFamilyMembers } from "@/services/userService";
import type { Family, User } from "@/types/finance";

type AuthContextValue = {
  loading: boolean;
  profile: User | null;
  family: Family | null;
  familyMembers: User[];
  refreshFamilyMembers: () => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    familyName?: string;
    inviteCode?: string;
  }) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      if (!firebaseUser) {
        setSession(null);
        setLoading(false);
        return;
      }

      const result = await loadSession(firebaseUser);
      if (result.success) {
        setSession(result.data);
      } else {
        console.error(result.error);
        setSession(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshFamilyMembers = useCallback(async () => {
    if (!session?.family.id) return;
    const result = await getFamilyMembers(session.family.id);
    if (result.success) {
      setSession((prev) =>
        prev ? { ...prev, familyMembers: result.data } : prev,
      );
    }
  }, [session?.family.id]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const result = await loginWithEmail(email, password);
    if (!result.success) {
      setLoading(false);
      return result.error;
    }
    setSession(result.data);
    setLoading(false);
    return null;
  }, []);

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      familyName?: string;
      inviteCode?: string;
    }) => {
      setLoading(true);
      const result = await registerWithEmail(input);
      if (!result.success) {
        setLoading(false);
        return result.error;
      }
      setSession(result.data);
      setLoading(false);
      return null;
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      profile: session?.profile ?? null,
      family: session?.family ?? null,
      familyMembers: session?.familyMembers ?? [],
      refreshFamilyMembers,
      login,
      register,
      logout,
    }),
    [loading, session, refreshFamilyMembers, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
