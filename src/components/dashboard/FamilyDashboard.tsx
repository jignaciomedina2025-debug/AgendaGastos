"use client";

import { useMemo } from "react";
import { Info, Users } from "lucide-react";
import { PurchaseCard } from "@/components/ui/PurchaseCard";
import type { Purchase, User } from "@/types/finance";
import { formatCurrency } from "@/utils/currency";
import {
  getMonthlyInstallmentAmount,
  getUserMonthlyShare,
} from "@/utils/purchaseMath";

export type FamilyDashboardProps = {
  currentUserId: string;
  monthYear: string;
  familyMembers: User[];
  purchases: Purchase[];
};

type MemberContribution = {
  user: User;
  amount: number;
};

export function FamilyDashboard({
  currentUserId,
  monthYear,
  familyMembers,
  purchases,
}: FamilyDashboardProps) {
  const commonFund = useMemo(
    () =>
      purchases.reduce(
        (sum, purchase) => sum + getMonthlyInstallmentAmount(purchase),
        0,
      ),
    [purchases],
  );

  const contributions: MemberContribution[] = useMemo(() => {
    return familyMembers
      .map((user) => ({
        user,
        amount: purchases.reduce(
          (sum, purchase) => sum + getUserMonthlyShare(purchase, user.id),
          0,
        ),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [familyMembers, purchases]);

  const maxContribution = Math.max(
    ...contributions.map((item) => item.amount),
    1,
  );

  const sharedPurchases = useMemo(
    () =>
      [...purchases]
        .filter((purchase) => purchase.isShared)
        .sort((a, b) => {
          const aPending = a.status === "PENDING_CONFIRMATION" ? 0 : 1;
          const bPending = b.status === "PENDING_CONFIRMATION" ? 0 : 1;
          if (aPending !== bPending) return aPending - bPending;
          return a.title.localeCompare(b.title, "es");
        }),
    [purchases],
  );

  const hasHiddenGifts = purchases.some(
    (purchase) => purchase.isGift && purchase.userId !== currentUserId,
  );

  return (
    <section className="mx-auto w-full max-w-lg space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
          Dashboard familiar
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#14201b]">
          Fondo del mes {monthYear}
        </h2>
      </header>

      <div className="rounded-2xl border border-[#d7e0db] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#5b6b64]">
              Fondo común del mes
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[#14201b]">
              {formatCurrency(commonFund)}
            </p>
            <p className="mt-2 text-xs text-[#5b6b64]">
              Suma de todas las cuotas activas de la familia
            </p>
          </div>
          <span className="rounded-xl bg-teal-50 p-2.5 text-teal-800">
            <Users className="size-5" aria-hidden />
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-[#d7e0db] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#14201b]">Aportes por miembro</h3>
        <p className="mt-1 text-xs text-[#5b6b64]">
          Cuánto debe transferir cada persona este mes
        </p>

        {contributions.length === 0 ? (
          <p className="mt-6 text-center text-sm text-[#5b6b64]">
            No hay miembros configurados.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {contributions.map(({ user, amount }) => {
              const width = `${Math.max((amount / maxContribution) * 100, amount > 0 ? 8 : 0)}%`;
              const isCurrent = user.id === currentUserId;

              return (
                <li key={user.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-[#14201b]">
                      {user.name}
                      {isCurrent ? (
                        <span className="ml-1.5 text-xs font-normal text-teal-700">
                          (tú)
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums font-semibold text-[#14201b]">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e8eeea]">
                    <div
                      className={`h-full rounded-full ${
                        isCurrent ? "bg-teal-700" : "bg-teal-500/80"
                      }`}
                      style={{ width }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#14201b]">
            Deudas compartidas (split)
          </h3>
          <span className="text-xs text-[#5b6b64]">
            {sharedPurchases.length} ítem
            {sharedPurchases.length === 1 ? "" : "s"}
          </span>
        </div>

        {sharedPurchases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d7e0db] bg-[#f8fbf9] px-4 py-8 text-center text-sm text-[#5b6b64]">
            No hay compras divididas este mes.
          </div>
        ) : (
          <ul className="space-y-3">
            {sharedPurchases.map((purchase) => (
              <li key={purchase.id}>
                <PurchaseCard
                  purchase={purchase}
                  currentUserId={currentUserId}
                  monthYear={monthYear}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p
        className="flex items-start gap-2 rounded-xl bg-[#f3f6f4] px-3 py-3 text-xs leading-relaxed text-[#5b6b64]"
        title="Las compras en modo regalo protegen el detalle del obsequio."
      >
        <Info className="mt-0.5 size-3.5 shrink-0 text-teal-700" aria-hidden />
        <span>
          Las compras marcadas como privadas suman al total pero sus detalles están
          ocultos para mantener la sorpresa.
          {hasHiddenGifts
            ? " Hay aportes privados incluidos en este resumen."
            : null}
        </span>
      </p>
    </section>
  );
}

export default FamilyDashboard;
