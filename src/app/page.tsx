"use client";

import { useCallback, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { FamilyDashboard } from "@/components/dashboard/FamilyDashboard";
import { PersonalDashboard } from "@/components/dashboard/PersonalDashboard";
import { PurchaseForm } from "@/components/forms/PurchaseForm";
import { useAuth } from "@/context/AuthContext";
import { getFamilyPurchases } from "@/services/purchaseService";
import type { Purchase } from "@/types/finance";

type TabId = "personal" | "family" | "new";

const TABS: { id: TabId; label: string }[] = [
  { id: "personal", label: "Personal" },
  { id: "family", label: "Familia" },
  { id: "new", label: "Nueva" },
];

function currentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function HomePage() {
  const { loading, profile, family, familyMembers, logout, refreshFamilyMembers } =
    useAuth();
  const [tab, setTab] = useState<TabId>("personal");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const monthYear = currentMonthYear();

  const reloadPurchases = useCallback(async () => {
    if (!profile || !family) return;

    setLoadingPurchases(true);
    setLoadError(null);

    const result = await getFamilyPurchases(profile.id, monthYear, family.id);
    if (!result.success) {
      setLoadError(result.error);
      setPurchases([]);
    } else {
      setPurchases(result.data.purchases);
    }

    setLoadingPurchases(false);
  }, [profile, family, monthYear]);

  useEffect(() => {
    if (!profile || !family) {
      setPurchases([]);
      return;
    }
    void reloadPurchases();
    void refreshFamilyMembers();
  }, [profile, family, reloadPurchases, refreshFamilyMembers]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="flex items-center gap-3 text-sm text-[#5b6b64]">
          <span className="size-4 animate-spin rounded-full border-2 border-teal-700/30 border-t-teal-700" />
          Cargando sesión…
        </div>
      </main>
    );
  }

  if (!profile || !family) {
    return <AuthScreen />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <div className="mb-6 flex max-w-xl items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
            {family.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#14201b] sm:text-4xl">
            Hola, {profile.name}
          </h1>
          <p className="text-sm text-[#5b6b64]">
            Código familia:{" "}
            <span className="font-semibold tracking-wider text-teal-800">
              {family.inviteCode}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e0db] bg-white px-3 py-2 text-xs font-medium text-[#5b6b64] shadow-sm transition hover:border-teal-600 hover:text-teal-800"
        >
          <LogOut className="size-3.5" aria-hidden />
          Salir
        </button>
      </div>

      <nav
        className="sticky top-0 z-10 -mx-4 mb-6 border-b border-[#d7e0db]/80 bg-[#f3f6f4]/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
        aria-label="Secciones"
      >
        <div className="mx-auto flex max-w-lg gap-2">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={[
                  "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-teal-700 text-white shadow-sm"
                    : "bg-white text-[#5b6b64] ring-1 ring-[#d7e0db]",
                ].join(" ")}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {loadError ? (
        <div className="mx-auto mb-4 w-full max-w-lg rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </div>
      ) : null}

      {loadingPurchases ? (
        <div className="mx-auto flex w-full max-w-lg items-center gap-3 text-sm text-[#5b6b64]">
          <span className="size-4 animate-spin rounded-full border-2 border-teal-700/30 border-t-teal-700" />
          Cargando compras…
        </div>
      ) : null}

      {tab === "personal" && !loadingPurchases ? (
        <PersonalDashboard
          currentUserId={profile.id}
          monthYear={monthYear}
          purchases={purchases}
        />
      ) : null}

      {tab === "family" && !loadingPurchases ? (
        <FamilyDashboard
          currentUserId={profile.id}
          monthYear={monthYear}
          familyMembers={familyMembers}
          purchases={purchases}
        />
      ) : null}

      {tab === "new" ? (
        <PurchaseForm
          currentUserId={profile.id}
          familyId={family.id}
          familyMembers={familyMembers}
          onSuccess={() => {
            void reloadPurchases();
            setTab("personal");
          }}
        />
      ) : null}
    </main>
  );
}
