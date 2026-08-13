"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import {
  addCard,
  CARD_BRAND_PRESETS,
  deleteCard,
  formatCardLabel,
} from "@/services/cardService";
import type { PaymentCard } from "@/types/finance";

type CardFormValues = {
  brand: string;
  customBrand: string;
  lastFour: string;
  label: string;
};

export type CardsManagerProps = {
  familyId: string;
  currentUserId: string;
  cards: PaymentCard[];
  onChanged: () => void;
};

export function CardsManager({
  familyId,
  currentUserId,
  cards,
  onChanged,
}: CardsManagerProps) {
  const [openForm, setOpenForm] = useState(cards.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CardFormValues>({
    defaultValues: {
      brand: "CMR",
      customBrand: "",
      lastFour: "",
      label: "",
    },
  });

  const brand = watch("brand");

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);

    const resolvedBrand =
      values.brand === "Otra" ? values.customBrand.trim() : values.brand;

    const result = await addCard({
      familyId,
      userId: currentUserId,
      brand: resolvedBrand,
      lastFour: values.lastFour,
      label: values.label,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    reset({ brand: "CMR", customBrand: "", lastFour: "", label: "" });
    setOpenForm(false);
    onChanged();
  });

  const onDelete = async (cardId: string) => {
    setDeletingId(cardId);
    setError(null);
    const result = await deleteCard(cardId);
    setDeletingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  return (
    <section className="mx-auto w-full max-w-lg space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
          Tus medios de pago
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#14201b]">
          Tarjetas
        </h2>
        <p className="text-sm text-[#5b6b64]">
          Guarda CMR, Ripley, Tricot, etc. con los últimos 4 dígitos para elegirlas al
          registrar una compra.
        </p>
      </header>

      <div className="space-y-3">
        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d7e0db] bg-[#f8fbf9] px-4 py-8 text-center text-sm text-[#5b6b64]">
            Aún no tienes tarjetas guardadas.
          </div>
        ) : (
          <ul className="space-y-3">
            {cards.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#d7e0db] bg-white p-4 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-lg bg-teal-50 p-2 text-teal-800">
                    <CreditCard className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#14201b]">
                      {formatCardLabel(card)}
                    </p>
                    <p className="text-xs text-[#5b6b64]">
                      {card.brand} · terminada en {card.lastFour}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onDelete(card.id)}
                  disabled={deletingId === card.id}
                  className="rounded-lg p-2 text-[#5b6b64] transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  aria-label={`Eliminar ${formatCardLabel(card)}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!openForm ? (
        <button
          type="button"
          onClick={() => setOpenForm(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#d7e0db] bg-white px-4 py-3 text-sm font-semibold text-teal-800 shadow-sm transition hover:border-teal-600"
        >
          <Plus className="size-4" aria-hidden />
          Agregar tarjeta
        </button>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-3xl border border-[#d7e0db] bg-white p-5 shadow-sm"
          noValidate
        >
          <h3 className="text-sm font-semibold text-[#14201b]">Nueva tarjeta</h3>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#14201b]">Nombre / marca</span>
            <select
              className={inputClass(Boolean(errors.brand))}
              {...register("brand", { required: "Elige una marca" })}
            >
              {CARD_BRAND_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </label>

          {brand === "Otra" ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[#14201b]">Nombre personalizado</span>
              <input
                type="text"
                placeholder="Ej. Hites"
                className={inputClass(Boolean(errors.customBrand))}
                {...register("customBrand", {
                  required: "Escribe el nombre de la tarjeta",
                })}
              />
              {errors.customBrand ? (
                <span className="text-xs text-[#b42318]">
                  {errors.customBrand.message}
                </span>
              ) : null}
            </label>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#14201b]">Últimos 4 dígitos</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              className={inputClass(Boolean(errors.lastFour))}
              {...register("lastFour", {
                required: "Ingresa los últimos 4 dígitos",
                pattern: {
                  value: /^\d{4}$/,
                  message: "Deben ser 4 números",
                },
              })}
            />
            {errors.lastFour ? (
              <span className="text-xs text-[#b42318]">{errors.lastFour.message}</span>
            ) : null}
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#14201b]">
              Apodo <span className="font-normal text-[#5b6b64]">(opcional)</span>
            </span>
            <input
              type="text"
              placeholder="Ej. CMR de Ana"
              className={inputClass(false)}
              {...register("label")}
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpenForm(false);
                setError(null);
              }}
              className="flex-1 rounded-2xl border border-[#d7e0db] px-4 py-3 text-sm font-medium text-[#5b6b64]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}
    </section>
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

export default CardsManager;
