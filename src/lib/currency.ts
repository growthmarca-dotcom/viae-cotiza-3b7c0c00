/**
 * Soporte multimoneda.
 * Por ahora el tipo de cambio es MANUAL (lo carga el agente en la cotización).
 * La estructura queda preparada para conectar una API de cotización en el futuro:
 * bastará con implementar `fetchExchangeRate` y usarla como valor inicial del campo.
 */

export const BASE_CURRENCIES = ["ARS", "USD"] as const;

/** Monedas soportadas en el formulario (las adicionales se mantienen por compatibilidad). */
export const CURRENCIES = ["ARS", "USD", "EUR", "MXN", "BRL", "CLP", "COP", "PEN"] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

/** Indica si para esta moneda se debe pedir el tipo de cambio manual (ARS por unidad). */
export function needsExchangeRate(currency: string) {
  return currency === "USD";
}

export function formatMoney(currency: string, value: number | null | undefined) {
  const n = Number(value ?? 0);
  return `${currency} ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type ConvertedTotals = {
  /** Total en la moneda de la cotización */
  total: number;
  currency: string;
  rate: number | null;
  totalArs: number | null;
  totalUsd: number | null;
};

/**
 * Calcula el total en ARS y en USD a partir del total de la cotización.
 * `rate` = cuántos ARS equivale 1 USD (valor manual).
 */
export function convertTotals(
  total: number | null | undefined,
  currency: string,
  rate: number | null | undefined,
): ConvertedTotals {
  const t = Number(total ?? 0);
  const r = rate != null && Number(rate) > 0 ? Number(rate) : null;

  let totalArs: number | null = null;
  let totalUsd: number | null = null;

  if (currency === "ARS") {
    totalArs = t;
    totalUsd = r ? round2(t / r) : null;
  } else if (currency === "USD") {
    totalUsd = t;
    totalArs = r ? round2(t * r) : null;
  }

  return { total: t, currency, rate: r, totalArs, totalUsd };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Placeholder para una futura integración con una API de tipo de cambio.
 * Hoy devuelve null: el valor siempre lo carga manualmente el agente.
 */
export async function fetchExchangeRate(_from = "USD", _to = "ARS"): Promise<number | null> {
  return null;
}
