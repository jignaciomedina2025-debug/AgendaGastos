/**
 * Currency and number formatters for finance UI.
 */

const DEFAULT_LOCALE = "es-CL";
const DEFAULT_CURRENCY = "CLP";

export function formatCurrency(
  value: number,
  options?: { locale?: string; currency?: string },
): string {
  const locale = options?.locale ?? DEFAULT_LOCALE;
  const currency = options?.currency ?? DEFAULT_CURRENCY;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CLP" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
