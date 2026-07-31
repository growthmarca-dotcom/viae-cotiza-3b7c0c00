import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Tipo de cambio operativo (v1.6).
 *
 * Carga MANUAL del dólar del día con fecha de vigencia y usuario responsable.
 * Se guarda histórico: nunca se pisa un valor anterior, se agrega uno nuevo.
 * La arquitectura queda preparada para conectar una API externa en el futuro
 * (`source` distinto de "manual" y `fetchApiRate`), pero hoy no se conecta.
 */

export type ExchangeRateRow = Tables<"exchange_rates">;

export type ExchangeRateInput = {
  rate: string;
  effective_date: string;
  note: string;
};

export const EMPTY_EXCHANGE_RATE: ExchangeRateInput = {
  rate: "",
  effective_date: new Date().toISOString().slice(0, 10),
  note: "",
};

/** Histórico de tipos de cambio USD → ARS del usuario (RLS: propios o admin). */
export async function listExchangeRates(limit = 30): Promise<ExchangeRateRow[]> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("base_currency", "USD")
    .eq("quote_currency", "ARS")
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ExchangeRateRow[];
}

/** Último tipo de cambio vigente (el más reciente por fecha de vigencia). */
export async function latestExchangeRate(): Promise<ExchangeRateRow | null> {
  const rows = await listExchangeRates(1);
  return rows[0] ?? null;
}

export async function saveExchangeRate(input: ExchangeRateInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const rate = Number(input.rate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("El tipo de cambio debe ser mayor a 0");

  const { error } = await supabase.from("exchange_rates").insert({
    user_id: uid,
    created_by: uid,
    base_currency: "USD",
    quote_currency: "ARS",
    source: "manual",
    rate,
    effective_date: input.effective_date || new Date().toISOString().slice(0, 10),
    note: input.note.trim() === "" ? null : input.note.trim(),
  });
  if (error) throw error;
}

export function formatRate(row: ExchangeRateRow | null | undefined) {
  if (!row) return "—";
  return `1 USD = ${Number(row.rate).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ARS`;
}

/**
 * Placeholder de la futura integración con una API de cotización.
 * Hoy devuelve null a propósito: el valor siempre es manual.
 */
export async function fetchApiRate(_base = "USD", _quote = "ARS"): Promise<number | null> {
  return null;
}
