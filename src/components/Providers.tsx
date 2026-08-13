"use client";

import { AuthProvider } from "@/context/AuthContext";

/**
 * Auth/Firebase only load in the browser so static export
 * pages like /offline can prerender without initializing Firebase.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
