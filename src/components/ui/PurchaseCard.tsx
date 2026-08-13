"use client";

import { AlertTriangle, Gift, CreditCard } from "lucide-react";
import type { Purchase } from "@/types/finance";
import { formatCurrency } from "@/utils/currency";
import {
  getInstallmentNumber,
  getMonthlyInstallmentAmount,
  getUserMonthlyShare,
} from "@/utils/purchaseMath";

export type PurchaseCardProps = {
  purchase: Purchase;
  currentUserId: string;
  /** Billing month used to compute installment progress (`YYYY-MM`). */
  monthYear: string;
};

function isHiddenGiftForViewer(purchase: Purchase, currentUserId: string): boolean {
  return purchase.isGift && purchase.userId !== currentUserId;
}

export function PurchaseCard({
  purchase,
  currentUserId,
  monthYear,
}: PurchaseCardProps) {
  const hidden = isHiddenGiftForViewer(purchase, currentUserId);
  const installmentNumber = Math.min(
    Math.max(getInstallmentNumber(purchase.firstBillingMonth, monthYear), 1),
    purchase.installmentsCount,
  );
  const progressRatio = installmentNumber / purchase.installmentsCount;

  const monthlyFull = getMonthlyInstallmentAmount(purchase);
  const userShare = getUserMonthlyShare(purchase, currentUserId);
  const displayAmount =
    purchase.isShared && purchase.splitBetweenUserIds.includes(currentUserId)
      ? userShare
      : monthlyFull;

  const title = hidden ? "Aporte Privado 🎁" : purchase.title;
  const storeLabel = hidden ? "Detalle oculto" : purchase.cardOrStore;
  const isPending = purchase.status === "PENDING_CONFIRMATION";

  return (
    <article className="rounded-xl border border-[#d7e0db] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[#14201b]">{title}</h3>
            {hidden ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                <Gift className="size-3" aria-hidden />
                Privado
              </span>
            ) : null}
            {isPending ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                <AlertTriangle className="size-3" aria-hidden />
                Valor por confirmar
              </span>
            ) : null}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-[#5b6b64]">
            <CreditCard className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{storeLabel}</span>
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-[#14201b]">
            {formatCurrency(displayAmount)}
          </p>
          <p className="text-[11px] text-[#5b6b64]">
            {purchase.isShared ? "Tu parte / mes" : "Cuota del mes"}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-[#5b6b64]">
          <span>
            Cuota {installmentNumber}/{purchase.installmentsCount}
          </span>
          {purchase.isShared ? (
            <span className="rounded-md bg-[#f3f6f4] px-1.5 py-0.5 text-[11px]">
              Compartida
            </span>
          ) : null}
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[#e8eeea]"
          role="progressbar"
          aria-valuenow={installmentNumber}
          aria-valuemin={1}
          aria-valuemax={purchase.installmentsCount}
          aria-label={`Progreso de cuotas ${installmentNumber} de ${purchase.installmentsCount}`}
        >
          <div
            className="h-full rounded-full bg-teal-600 transition-[width]"
            style={{ width: `${Math.min(progressRatio * 100, 100)}%` }}
          />
        </div>
      </div>
    </article>
  );
}

export default PurchaseCard;
