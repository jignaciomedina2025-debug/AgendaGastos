"use client";

import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Wallet } from "lucide-react";
import { PurchaseCard } from "@/components/ui/PurchaseCard";
import type { Purchase } from "@/types/finance";
import { formatCurrency } from "@/utils/currency";
import {
  getUserMonthlyShare,
  isPurchaseRelevantToUser,
} from "@/utils/purchaseMath";

export type PersonalDashboardProps = {
  currentUserId: string;
  monthYear: string;
  purchases: Purchase[];
};

const CHART_COLORS = [
  "#0f766e",
  "#0e7490",
  "#365314",
  "#1e3a5f",
  "#78716c",
  "#115e59",
  "#3f6212",
];

type Slice = {
  name: string;
  value: number;
};

function sortPurchasesForAttention(purchases: Purchase[]): Purchase[] {
  return [...purchases].sort((a, b) => {
    const aPending = a.status === "PENDING_CONFIRMATION" ? 0 : 1;
    const bPending = b.status === "PENDING_CONFIRMATION" ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return a.title.localeCompare(b.title, "es");
  });
}

export function PersonalDashboard({
  currentUserId,
  monthYear,
  purchases,
}: PersonalDashboardProps) {
  const personalPurchases = useMemo(
    () =>
      sortPurchasesForAttention(
        purchases.filter((purchase) =>
          isPurchaseRelevantToUser(purchase, currentUserId),
        ),
      ),
    [purchases, currentUserId],
  );

  const totalThisMonth = useMemo(
    () =>
      personalPurchases.reduce(
        (sum, purchase) => sum + getUserMonthlyShare(purchase, currentUserId),
        0,
      ),
    [personalPurchases, currentUserId],
  );

  const distribution: Slice[] = useMemo(() => {
    const buckets = new Map<string, number>();

    for (const purchase of personalPurchases) {
      const share = getUserMonthlyShare(purchase, currentUserId);
      if (share <= 0) continue;

      const hidden = purchase.isGift && purchase.userId !== currentUserId;
      const key = hidden ? "Aportes privados" : purchase.cardOrStore || "Sin etiqueta";
      buckets.set(key, (buckets.get(key) ?? 0) + share);
    }

    return [...buckets.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [personalPurchases, currentUserId]);

  const pendingCount = personalPurchases.filter(
    (purchase) => purchase.status === "PENDING_CONFIRMATION",
  ).length;

  return (
    <section className="mx-auto w-full max-w-lg space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
          Dashboard personal
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#14201b]">
          Tu mes {monthYear}
        </h2>
      </header>

      <div className="rounded-2xl border border-teal-700/15 bg-gradient-to-br from-teal-800 to-teal-700 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-teal-100">
              Total a pagar este mes
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
              {formatCurrency(totalThisMonth)}
            </p>
            {pendingCount > 0 ? (
              <p className="mt-2 text-xs text-amber-100">
                {pendingCount} compra{pendingCount === 1 ? "" : "s"} con valor por
                confirmar
              </p>
            ) : (
              <p className="mt-2 text-xs text-teal-100">Sin pendientes de confirmación</p>
            )}
          </div>
          <span className="rounded-xl bg-white/10 p-2.5">
            <Wallet className="size-5" aria-hidden />
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-[#d7e0db] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#14201b]">
          Distribución por tarjeta / tienda
        </h3>

        {distribution.length === 0 ? (
          <p className="mt-6 text-center text-sm text-[#5b6b64]">
            Aún no hay compras activas este mes.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center">
            <div className="mx-auto h-48 w-full max-w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {distribution.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "#d7e0db",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ul className="space-y-2">
              {distribution.map((slice, index) => (
                <li
                  key={slice.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2 text-[#5b6b64]">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                    <span className="truncate">{slice.name}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-[#14201b]">
                    {formatCurrency(slice.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#14201b]">Tus compras activas</h3>
          <span className="text-xs text-[#5b6b64]">
            {personalPurchases.length} ítem
            {personalPurchases.length === 1 ? "" : "s"}
          </span>
        </div>

        {personalPurchases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d7e0db] bg-[#f8fbf9] px-4 py-8 text-center text-sm text-[#5b6b64]">
            No tienes compras que impacten este mes.
          </div>
        ) : (
          <ul className="space-y-3">
            {personalPurchases.map((purchase) => (
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
    </section>
  );
}

export default PersonalDashboard;
