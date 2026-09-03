import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * VIAE CORE v1.12 — FINANCIAL CORE (Money Service)
 *
 * Servicio central de dinero y conversión. Toda conversión futura del sistema
 * (Smart Quotes, Quotations, Bookings, Commissions, Accounting, Reports,
 * Marketplace, Payments) debe usar estas funciones y NO cálculos ad-hoc.
 *
 * Reglas:
 * - Las cotizaciones son históricas: nunca se sobrescriben.
 * - La conversión siempre se resuelve a una fecha (hoy o una fecha histórica).
 * - Nunca se asume el tipo de cambio vigente si se pide una fecha pasada.
 *
 * Preparado para el futuro (todavía NO implementado):
 * - `source` admite múltiples fuentes (manual, api, banco, etc.).
 * - `rate_type` admite distintos tipos (operational, official, buy, sell, mid).
 * - la sincronización automática con APIs externas se agregará más adelante.
 *
 * Nota: la tabla legacy `exchange_rates` (v1.6, dólar operativo manual) sigue
 * vigente y no se reemplaza en esta fase.
 */

export type CurrencyRow = Tables<"currencies">;
export type CurrencyExchangeRateRow = Tables<"currency_exchange_rates">;

export type RateType = "operational" | "official" | "buy" | "sell" | "mid" | "custom";

export const DEFAULT_RATE_TYPE: RateType = "operational";

/** Decimales por moneda conocidos; sirve de respaldo si no hay catálogo cargado. */
const FALLBACK_DECIMALS: Record<string, number> = {
  ARS: 2,
  USD: 2,
  EUR: 2,
  BRL: 2,
  CLP: 0,
  UYU: 2,
};

// ---------------------------------------------------------------- catálogo

/** Catálogo de monedas. Por defecto solo las activas. */
export async function listCurrencies(includeInactive = false): Promise<CurrencyRow[]> {
  let query = supabase.from("currencies").select("*").order("iso_code");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CurrencyRow[];
}

export async function getCurrency(isoCode: string): Promise<CurrencyRow | null> {
  const { data, error } = await supabase
    .from("currencies")
    .select("*")
    .eq("iso_code", isoCode.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as CurrencyRow | null) ?? null;
}

// ---------------------------------------------------------------- redondeo

export function decimalsFor(isoCode: string, currency?: CurrencyRow | null): number {
  if (currency?.decimal_places != null) return currency.decimal_places;
  return FALLBACK_DECIMALS[isoCode.toUpperCase()] ?? 2;
}

/** Redondea un importe según los decimales de la moneda. */
export function roundMoney(
  amount: number | null | undefined,
  isoCode: string,
  currency?: CurrencyRow | null,
): number {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return 0;
  const places = decimalsFor(isoCode, currency);
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Formatea un importe con el código ISO de la moneda (formato es-AR). */
export function formatMoney(
  amount: number | null | undefined,
  isoCode: string,
  currency?: CurrencyRow | null,
): string {
  const places = decimalsFor(isoCode, currency);
  const value = roundMoney(amount, isoCode, currency);
  return `${isoCode.toUpperCase()} ${value.toLocaleString("es-AR", {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  })}`;
}

// ---------------------------------------------------------------- tasas

export type GetExchangeRateOptions = {
  /** Fecha de referencia. Si se omite se usa la fecha actual. */
  at?: Date | string;
  /** Tipo de cambio requerido. Si se omite se acepta cualquiera. */
  rateType?: RateType | null;
};

/**
 * Tasa vigente a una fecha dada (histórica o actual).
 * Devuelve `null` cuando no hay cotización cargada para ese par y fecha.
 */
export async function getExchangeRate(
  from: string,
  to: string,
  options: GetExchangeRateOptions = {},
): Promise<number | null> {
  const fromIso = from.toUpperCase();
  const toIso = to.toUpperCase();
  if (fromIso === toIso) return 1;

  const at = options.at
    ? new Date(options.at).toISOString()
    : new Date().toISOString();

  const args: { _from_iso: string; _to_iso: string; _at: string; _rate_type?: string } = {
    _from_iso: fromIso,
    _to_iso: toIso,
    _at: at,
  };
  if (options.rateType) args._rate_type = options.rateType;
  const { data, error } = await supabase.rpc("currency_rate_at", args);
  if (error) throw error;
  const rate = data == null ? null : Number(data);
  return rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Histórico de cotizaciones de un par de monedas (más reciente primero). */
export async function listExchangeRateHistory(
  from?: string,
  to?: string,
  limit = 50,
): Promise<CurrencyExchangeRateRow[]> {
  const { data, error } = await supabase
    .from("currency_exchange_rates")
    .select("*, from_currency:currencies!currency_exchange_rates_from_currency_id_fkey(iso_code), to_currency:currencies!currency_exchange_rates_to_currency_id_fkey(iso_code)")
    .order("valid_from", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (CurrencyExchangeRateRow & {
    from_currency: { iso_code: string } | null;
    to_currency: { iso_code: string } | null;
  })[];
  return rows.filter((r) => {
    if (from && r.from_currency?.iso_code !== from.toUpperCase()) return false;
    if (to && r.to_currency?.iso_code !== to.toUpperCase()) return false;
    return true;
  });
}

export type SaveExchangeRateInput = {
  fromIso: string;
  toIso: string;
  rate: number;
  rateType?: RateType;
  source?: string;
  validFrom?: Date | string;
  validUntil?: Date | string | null;
  note?: string | null;
};

/**
 * Alta de una cotización. El valor de las tasas históricas nunca se modifica:
 * la RPC `register_currency_exchange_rate` sólo cierra la vigencia del período
 * abierto anterior del mismo par (así no se solapan) e inserta la nueva tasa.
 * Las validaciones fuertes (tasa > 0, monedas activas, períodos superpuestos,
 * permiso de administrador) se aplican en la base de datos.
 */
export async function saveExchangeRate(input: SaveExchangeRateInput): Promise<void> {
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    throw new Error("El tipo de cambio debe ser mayor a 0");
  }
  const { error } = await supabase.rpc("register_currency_exchange_rate", {
    _from_iso: input.fromIso.toUpperCase(),
    _to_iso: input.toIso.toUpperCase(),
    _rate: input.rate,
    _valid_from: new Date(input.validFrom ?? new Date()).toISOString(),
    _rate_type: input.rateType ?? DEFAULT_RATE_TYPE,
    _source: input.source ?? "manual",
    _note: input.note?.trim() ? input.note.trim() : undefined,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------- conversión

export type MoneyAmount = { amount: number; currency: string };

export type ConvertMoneyResult = {
  amount: number;
  currency: string;
  rate: number;
  /** Fecha con la que se resolvió la cotización. */
  at: string;
  source: "same-currency" | "exchange-rate";
};

/**
 * Convierte un importe entre monedas usando la cotización vigente a la fecha
 * indicada (o la actual). Lanza si no existe cotización: el Financial Core
 * nunca inventa un tipo de cambio.
 */
export async function convertMoney(
  money: MoneyAmount,
  toIso: string,
  options: GetExchangeRateOptions = {},
): Promise<ConvertMoneyResult> {
  const fromIso = money.currency.toUpperCase();
  const target = toIso.toUpperCase();
  const at = options.at ? new Date(options.at).toISOString() : new Date().toISOString();

  if (fromIso === target) {
    return {
      amount: roundMoney(money.amount, target),
      currency: target,
      rate: 1,
      at,
      source: "same-currency",
    };
  }

  const rate = await getExchangeRate(fromIso, target, { ...options, at });
  if (rate == null) {
    throw new Error(`No hay cotización ${fromIso} → ${target} vigente a la fecha indicada`);
  }

  return {
    amount: roundMoney(Number(money.amount ?? 0) * rate, target),
    currency: target,
    rate,
    at,
    source: "exchange-rate",
  };
}

/** Suma importes multimoneda convirtiéndolos a una moneda destino. */
export async function sumMoney(
  items: MoneyAmount[],
  toIso: string,
  options: GetExchangeRateOptions = {},
): Promise<{ total: number; currency: string; skipped: MoneyAmount[] }> {
  let total = 0;
  const skipped: MoneyAmount[] = [];
  for (const item of items) {
    try {
      const converted = await convertMoney(item, toIso, options);
      total += converted.amount;
    } catch {
      skipped.push(item);
    }
  }
  return { total: roundMoney(total, toIso), currency: toIso.toUpperCase(), skipped };
}
