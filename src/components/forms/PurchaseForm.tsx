"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { addPurchase } from "@/services/purchaseService";
import { formatCardLabel } from "@/services/cardService";
import type {
  InterestType,
  NewPurchaseInput,
  PaymentCard,
  Purchase,
  PurchaseStatus,
  User,
} from "@/types/finance";
import { formatCurrency } from "@/utils/currency";

export type PurchaseFormValues = {
  title: string;
  cardId: string;
  cardOrStore: string;
  totalAmount: string;
  installmentsCount: number;
  interestType: InterestType;
  installmentValue: string;
  firstBillingMonth: string;
  isShared: boolean;
  splitBetweenUserIds: string[];
  isGift: boolean;
};

export type PurchaseFormProps = {
  currentUserId: string;
  familyId: string;
  familyMembers: User[];
  cards: PaymentCard[];
  /** When true, skips Firestore and returns a mock success response. */
  simulateSubmission?: boolean;
  onSuccess?: (purchase: Purchase) => void;
  onRequestAddCard?: () => void;
};

type SubmitState = "idle" | "loading" | "success" | "error";

const INSTALLMENT_OPTIONS = Array.from({ length: 48 }, (_, index) => index + 1);

function currentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseAmount(raw: string): number {
  const normalized = raw.replace(",", ".").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

function resolveStatus(
  interestType: InterestType,
  installmentValue?: number,
): PurchaseStatus {
  const hasExact =
    typeof installmentValue === "number" &&
    Number.isFinite(installmentValue) &&
    installmentValue > 0;

  if (interestType === "WITH_INTEREST" && !hasExact) {
    return "PENDING_CONFIRMATION";
  }

  return "CONFIRMED";
}

export function PurchaseForm({
  currentUserId,
  familyId,
  familyMembers,
  cards,
  simulateSubmission = false,
  onSuccess,
  onRequestAddCard,
}: PurchaseFormProps) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<PurchaseFormValues>({
    defaultValues: {
      title: "",
      cardId: cards[0]?.id ?? "",
      cardOrStore: cards[0] ? formatCardLabel(cards[0]) : "",
      totalAmount: "",
      installmentsCount: 1,
      interestType: "NO_INTEREST",
      installmentValue: "",
      firstBillingMonth: currentMonthYear(),
      isShared: false,
      splitBetweenUserIds: [],
      isGift: false,
    },
    mode: "onBlur",
  });

  const interestType = useWatch({ control, name: "interestType" });
  const totalAmountRaw = useWatch({ control, name: "totalAmount" });
  const installmentsCount = useWatch({ control, name: "installmentsCount" });
  const installmentValueRaw = useWatch({ control, name: "installmentValue" });
  const isShared = useWatch({ control, name: "isShared" });
  const isGift = useWatch({ control, name: "isGift" });
  const splitBetweenUserIds = useWatch({ control, name: "splitBetweenUserIds" });
  const selectedCardId = useWatch({ control, name: "cardId" });

  useEffect(() => {
    if (!selectedCardId) {
      setValue("cardOrStore", "");
      return;
    }
    const selected = cards.find((card) => card.id === selectedCardId);
    if (selected) {
      setValue("cardOrStore", formatCardLabel(selected), { shouldValidate: true });
    }
  }, [selectedCardId, cards, setValue]);

  const totalAmount = parseAmount(totalAmountRaw ?? "");
  const installmentValue = parseAmount(installmentValueRaw ?? "");

  const autoInstallment =
    interestType === "NO_INTEREST" &&
    Number.isFinite(totalAmount) &&
    totalAmount > 0 &&
    installmentsCount >= 1
      ? totalAmount / installmentsCount
      : null;

  useEffect(() => {
    if (interestType !== "NO_INTEREST" || autoInstallment === null) return;
    setValue("installmentValue", autoInstallment.toFixed(2), {
      shouldValidate: true,
    });
  }, [interestType, autoInstallment, setValue]);

  const showPendingInterestBanner =
    interestType === "WITH_INTEREST" &&
    (!Number.isFinite(installmentValue) || installmentValue <= 0);

  const sharePreview = useMemo(() => {
    if (!isShared || !Number.isFinite(totalAmount) || totalAmount <= 0) {
      return null;
    }

    const selected = splitBetweenUserIds ?? [];
    if (selected.length < 2) return null;

    return {
      perPerson: totalAmount / selected.length,
      count: selected.length,
    };
  }, [isShared, totalAmount, splitBetweenUserIds]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitState("loading");
    setSubmitError(null);

    const parsedTotal = parseAmount(values.totalAmount);
    const parsedInstallment = parseAmount(values.installmentValue);
    const hasExactInstallment =
      Number.isFinite(parsedInstallment) && parsedInstallment > 0;

    const payload: NewPurchaseInput = {
      userId: currentUserId,
      familyId,
      title: values.title.trim(),
      cardOrStore: values.cardOrStore.trim(),
      cardId: values.cardId || undefined,
      totalAmount: parsedTotal,
      installmentsCount: Number(values.installmentsCount),
      installmentValue: hasExactInstallment ? parsedInstallment : undefined,
      interestType: values.interestType,
      status: resolveStatus(
        values.interestType,
        hasExactInstallment ? parsedInstallment : undefined,
      ),
      purchaseDate: new Date(),
      firstBillingMonth: values.firstBillingMonth,
      isShared: values.isShared,
      splitBetweenUserIds: values.isShared ? values.splitBetweenUserIds : [],
      isGift: values.isGift,
    };

    try {
      if (simulateSubmission) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        const simulated: Purchase = {
          ...payload,
          id: `sim_${crypto.randomUUID()}`,
          amountPerUser: payload.isShared
            ? payload.totalAmount / Math.max(payload.splitBetweenUserIds.length, 1)
            : payload.totalAmount,
          createdAt: new Date(),
        };
        setSubmitState("success");
        onSuccess?.(simulated);
        reset({
          title: "",
          cardId: cards[0]?.id ?? "",
          cardOrStore: cards[0] ? formatCardLabel(cards[0]) : "",
          totalAmount: "",
          installmentsCount: 1,
          interestType: "NO_INTEREST",
          installmentValue: "",
          firstBillingMonth: currentMonthYear(),
          isShared: false,
          splitBetweenUserIds: [],
          isGift: false,
        });
        return;
      }

      const result = await addPurchase(payload);
      if (!result.success) {
        setSubmitState("error");
        setSubmitError(result.error);
        return;
      }

      setSubmitState("success");
      onSuccess?.(result.data);
      reset({
        title: "",
        cardId: cards[0]?.id ?? "",
        cardOrStore: cards[0] ? formatCardLabel(cards[0]) : "",
        totalAmount: "",
        installmentsCount: 1,
        interestType: "NO_INTEREST",
        installmentValue: "",
        firstBillingMonth: currentMonthYear(),
        isShared: false,
        splitBetweenUserIds: [],
        isGift: false,
      });
    } catch (error) {
      setSubmitState("error");
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo registrar la compra.",
      );
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-lg rounded-3xl border border-[#d7e0db] bg-white/95 p-5 shadow-[0_18px_50px_-28px_rgba(15,55,45,0.55)] backdrop-blur sm:p-7"
      noValidate
    >
      <header className="mb-6 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
          Nueva compra
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#14201b]">
          Registrar gasto
        </h2>
        <p className="text-sm text-[#5b6b64]">
          Completa los datos de la compra. Puedes ajustar el mes de primera cuota si la
          facturación viene desfasada.
        </p>
      </header>

      <div className="space-y-5">
        <Field label="Título" error={errors.title?.message}>
          <input
            type="text"
            placeholder="Ej. Notebook oficina"
            className={inputClass(Boolean(errors.title))}
            {...register("title", {
              required: "El título es obligatorio",
              minLength: { value: 2, message: "Mínimo 2 caracteres" },
            })}
          />
        </Field>

        <Field label="Tarjeta" error={errors.cardId?.message || errors.cardOrStore?.message}>
          {cards.length === 0 ? (
            <div className="space-y-2 rounded-2xl border border-dashed border-[#d7e0db] bg-[#f8fbf9] px-3.5 py-3">
              <p className="text-sm text-[#5b6b64]">
                Primero guarda una tarjeta (CMR, Ripley, etc.).
              </p>
              {onRequestAddCard ? (
                <button
                  type="button"
                  onClick={onRequestAddCard}
                  className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
                >
                  Ir a Tarjetas
                </button>
              ) : null}
              <input type="hidden" {...register("cardOrStore")} />
              <input
                type="hidden"
                {...register("cardId", {
                  required: "Agrega una tarjeta antes de registrar la compra",
                })}
              />
            </div>
          ) : (
            <>
              <select
                className={inputClass(Boolean(errors.cardId))}
                {...register("cardId", {
                  required: "Selecciona una tarjeta",
                })}
              >
                <option value="">Selecciona una tarjeta</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {formatCardLabel(card)}
                  </option>
                ))}
              </select>
              <input type="hidden" {...register("cardOrStore", { required: true })} />
              {onRequestAddCard ? (
                <button
                  type="button"
                  onClick={onRequestAddCard}
                  className="mt-1 text-xs font-medium text-teal-800"
                >
                  + Agregar otra tarjeta
                </button>
              ) : null}
            </>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monto total" error={errors.totalAmount?.message}>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="0"
              className={inputClass(Boolean(errors.totalAmount))}
              {...register("totalAmount", {
                required: "El monto es obligatorio",
                validate: (value) => {
                  const amount = parseAmount(value);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    return "Ingresa un monto válido mayor a 0";
                  }
                  return true;
                },
              })}
            />
          </Field>

          <Field label="Cuotas" error={errors.installmentsCount?.message}>
            <select
              className={inputClass(Boolean(errors.installmentsCount))}
              {...register("installmentsCount", {
                valueAsNumber: true,
                required: "Selecciona las cuotas",
                min: { value: 1, message: "Mínimo 1 cuota" },
                max: { value: 48, message: "Máximo 48 cuotas" },
              })}
            >
              {INSTALLMENT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count} {count === 1 ? "cuota" : "cuotas"}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-[#14201b]">
            Tipo de interés
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InterestOption
              value="NO_INTEREST"
              label="Sin interés"
              description="Cuota = total ÷ cuotas"
              selected={interestType === "NO_INTEREST"}
              {...register("interestType")}
            />
            <InterestOption
              value="WITH_INTEREST"
              label="Con interés"
              description="Confirmarás la cuota real después"
              selected={interestType === "WITH_INTEREST"}
              {...register("interestType")}
            />
          </div>
        </fieldset>

        <Field
          label="Valor de la cuota"
          hint={
            interestType === "NO_INTEREST"
              ? "Calculado automáticamente y bloqueado"
              : "Opcional hasta que llegue la boleta"
          }
          error={errors.installmentValue?.message}
        >
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder={interestType === "WITH_INTEREST" ? "Pendiente" : "0"}
            readOnly={interestType === "NO_INTEREST"}
            className={`${inputClass(Boolean(errors.installmentValue))} ${
              interestType === "NO_INTEREST"
                ? "cursor-not-allowed bg-[#f3f6f4] text-[#5b6b64]"
                : ""
            }`}
            {...register("installmentValue")}
          />
        </Field>

        {showPendingInterestBanner ? (
          <div
            role="status"
            className="rounded-2xl border border-amber-200 bg-[#fffaeb] px-4 py-3 text-sm text-amber-800"
          >
            El valor exacto de la cuota quedará pendiente de confirmación hasta que
            llegue la boleta.
          </div>
        ) : null}

        <Field
          label="Primera facturación"
          hint="Formato YYYY-MM. Útil para compras retroactivas."
          error={errors.firstBillingMonth?.message}
        >
          <input
            type="month"
            className={inputClass(Boolean(errors.firstBillingMonth))}
            {...register("firstBillingMonth", {
              required: "Selecciona el mes de primera cuota",
              pattern: {
                value: /^\d{4}-(0[1-9]|1[0-2])$/,
                message: "Usa el formato YYYY-MM",
              },
            })}
          />
        </Field>

        <ToggleRow
          title="Dividir con la familia"
          description="Reparte el total en partes iguales entre los miembros elegidos."
          checked={Boolean(isShared)}
          {...register("isShared")}
        />

        {isShared ? (
          <div className="space-y-3 rounded-2xl border border-[#d7e0db] bg-[#f8fbf9] p-4">
            <p className="text-sm font-medium text-[#14201b]">Miembros incluidos</p>
            <Controller
              control={control}
              name="splitBetweenUserIds"
              rules={{
                validate: (value, formValues) => {
                  if (!formValues.isShared) return true;
                  if (!value || value.length < 2) {
                    return "Selecciona al menos 2 personas para dividir";
                  }
                  return true;
                },
              }}
              render={({ field }) => (
                <ul className="space-y-2">
                  {familyMembers.map((member) => {
                    const checked = field.value.includes(member.id);
                    return (
                      <li key={member.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-white">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-[#d7e0db] text-teal-700 focus:ring-teal-600"
                            checked={checked}
                            onChange={(event) => {
                              if (event.target.checked) {
                                field.onChange([...field.value, member.id]);
                              } else {
                                field.onChange(
                                  field.value.filter((id) => id !== member.id),
                                );
                              }
                            }}
                          />
                          <span className="text-sm text-[#14201b]">{member.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            />
            {errors.splitBetweenUserIds?.message ? (
              <p className="text-xs text-[#b42318]">
                {errors.splitBetweenUserIds.message}
              </p>
            ) : null}

            {sharePreview ? (
              <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900">
                Cada uno pagará{" "}
                <span className="font-semibold">
                  {formatCurrency(sharePreview.perPerson)}
                </span>{" "}
                ({sharePreview.count} personas)
              </div>
            ) : (
              <p className="text-xs text-[#5b6b64]">
                Selecciona 2 o más personas para ver el reparto en vivo.
              </p>
            )}
          </div>
        ) : null}

        <ToggleRow
          title="Modo Regalo — Ocultar detalles"
          description="Los demás verán “Compra Oculta”, pero el monto sí suma a la deuda familiar."
          checked={Boolean(isGift)}
          {...register("isGift")}
        />

        {submitState === "success" ? (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Compra registrada correctamente.
          </div>
        ) : null}

        {submitState === "error" && submitError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {submitError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitState === "loading"}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitState === "loading" ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Guardando compra…
            </>
          ) : (
            "Registrar compra"
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[#14201b]">{label}</span>
      {children}
      {hint && !error ? <span className="block text-xs text-[#5b6b64]">{hint}</span> : null}
      {error ? <span className="block text-xs text-[#b42318]">{error}</span> : null}
    </label>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "w-full rounded-2xl border bg-white px-3.5 py-3 text-sm text-[#14201b] outline-none transition",
    "placeholder:text-[#8a9891] focus:ring-2 focus:ring-teal-600/25",
    hasError
      ? "border-red-300 focus:border-red-400"
      : "border-[#d7e0db] focus:border-teal-600",
  ].join(" ");
}

function InterestOption({
  value,
  label,
  description,
  selected,
  ...rest
}: {
  value: InterestType;
  label: string;
  description: string;
  selected: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={[
        "flex cursor-pointer gap-3 rounded-2xl border px-3.5 py-3 transition",
        selected
          ? "border-teal-600 bg-teal-50 shadow-sm"
          : "border-[#d7e0db] bg-white hover:border-teal-300",
      ].join(" ")}
    >
      <input type="radio" value={value} className="mt-1 accent-teal-700" {...rest} />
      <span>
        <span className="block text-sm font-medium text-[#14201b]">{label}</span>
        <span className="block text-xs text-[#5b6b64]">{description}</span>
      </span>
    </label>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  ...rest
}: {
  title: string;
  description: string;
  checked: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-[#d7e0db] bg-white px-4 py-3.5">
      <span className="space-y-0.5">
        <span className="block text-sm font-medium text-[#14201b]">{title}</span>
        <span className="block text-xs leading-relaxed text-[#5b6b64]">
          {description}
        </span>
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input type="checkbox" className="peer sr-only" {...rest} />
        <span
          className={[
            "absolute inset-0 rounded-full transition",
            checked ? "bg-teal-700" : "bg-[#d7e0db]",
          ].join(" ")}
        />
        <span
          className={[
            "absolute left-0.5 size-5 rounded-full bg-white shadow transition",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </span>
    </label>
  );
}

export default PurchaseForm;
