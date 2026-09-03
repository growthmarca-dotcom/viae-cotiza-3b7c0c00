import { supabase } from "@/integrations/supabase/client";

/**
 * Motor de comisiones — v1.9.4 Fase A (SIMULACIÓN).
 *
 * Esta capa es de SOLO LECTURA: llama a `simulate_commission` /
 * `simulate_commission_transport`, que resuelven el acuerdo y la regla que
 * aplicarían y calculan el importe, sin insertar nada en `commissions`.
 *
 * No hay devengo, liquidaciones ni pagos todavía. La tabla `commissions`
 * existe vacía y `commission_history` queda preparada para el futuro
 * (intencionalmente separada de `agreement_history`).
 *
 * Visibilidad: administrador ve todo; operaciones ve la simulación sin costos
 * ni márgenes; agente ve un resumen de lo propio; proveedor sin acceso.
 * El recorte lo hace la función en la base, no el cliente.
 */

export type CommissionBase = "gross" | "net" | "cost" | "margin";
export type CommissionCalcType = "percentage" | "fixed";

export type CommissionSimulation = {
  found: boolean;
  has_agreement?: boolean;
  simulation?: boolean;
  booking_service_id?: string;
  transport_service_id?: string;
  booking_id?: string | null;
  service_kind?: string | null;
  agreement_id?: string | null;
  agreement_version?: number | null;
  agreement_title?: string | null;
  rule_id?: string | null;
  rule_label?: string | null;
  base?: CommissionBase;
  calc_type?: CommissionCalcType;
  calc_value?: number | null;
  excludes_taxes?: boolean;
  excludes_extras?: boolean;
  currency?: string;
  sale_currency?: string;
  gross_sale_amount?: number | null;
  taxes_amount?: number | null;
  extras_amount?: number | null;
  discount_amount?: number | null;
  cost_amount?: number | null;
  base_amount?: number | null;
  commission_amount?: number | null;
  warnings?: string[];
  score?: number;
  restricted?: boolean;
  summary_only?: boolean;
};

export const BASE_LABELS: Record<CommissionBase, string> = {
  gross: "Sobre bruto",
  net: "Sobre neto",
  cost: "Sobre costo",
  margin: "Sobre margen",
};

export function baseLabel(v: string | null | undefined) {
  return BASE_LABELS[(v ?? "") as CommissionBase] ?? "—";
}

export function calcLabel(sim: CommissionSimulation) {
  if (sim.calc_value == null) return "—";
  return sim.calc_type === "percentage"
    ? `${sim.calc_value}%`
    : `${sim.currency ?? "ARS"} ${Number(sim.calc_value).toLocaleString("es-AR")}`;
}

/** Simulación de la comisión de un servicio de reserva. No escribe nada. */
export async function simulateCommission(bookingServiceId: string): Promise<CommissionSimulation> {
  const { data, error } = await supabase.rpc("simulate_commission", {
    _booking_service_id: bookingServiceId,
  });
  if (error) throw error;
  return (data ?? { found: false }) as unknown as CommissionSimulation;
}

/**
 * Simulación para transporte: preparada como lectura. No modifica
 * `transport_services` ni la economía existente del módulo.
 */
export async function simulateTransportCommission(
  transportServiceId: string,
): Promise<CommissionSimulation> {
  const { data, error } = await supabase.rpc("simulate_commission_transport", {
    _transport_service_id: transportServiceId,
  });
  if (error) throw error;
  return (data ?? { found: false }) as unknown as CommissionSimulation;
}

/**
 * Totales de simulación agrupados POR MONEDA.
 * Nunca se suman monedas distintas en un único total; la moneda de análisis
 * se maneja aparte, en los tableros que la usan.
 */
export type CommissionTotals = {
  byCurrency: { currency: string; commission: number; count: number }[];
  withoutAgreement: number;
  withWarnings: number;
};

export function computeSimulationTotals(rows: CommissionSimulation[]): CommissionTotals {
  const map = new Map<string, { commission: number; count: number }>();
  let withoutAgreement = 0;
  let withWarnings = 0;

  for (const r of rows) {
    if (!r.has_agreement) withoutAgreement += 1;
    if ((r.warnings?.length ?? 0) > 0) withWarnings += 1;
    if (r.commission_amount == null) continue;
    const currency = r.currency ?? "ARS";
    const acc = map.get(currency) ?? { commission: 0, count: 0 };
    acc.commission = Math.round((acc.commission + Number(r.commission_amount)) * 100) / 100;
    acc.count += 1;
    map.set(currency, acc);
  }

  return {
    byCurrency: [...map.entries()]
      .map(([currency, v]) => ({ currency, ...v }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    withoutAgreement,
    withWarnings,
  };
}

// =====================================================================
// Fase B1/B2 — DEVENGO, ESTADOS E HISTORIAL (persistencia real)
//
// El cálculo NO se replica en React: todo pasa por las RPC existentes
// (`accrue_commission`, `accrue_booking_commissions`, `set_commission_status`),
// que reutilizan `resolve_agreement()` + `compute_commission()`.
// Fuente oficial del cálculo: commercial_agreements + agreement_rules.
// Los campos agents.commission_* NO participan del cálculo.
// =====================================================================

import type { Tables } from "@/integrations/supabase/types";

export type Commission = Tables<"commissions">;
export type CommissionHistoryRow = Tables<"commission_history">;

export type CommissionStatus = "simulated" | "accrued" | "approved" | "settled" | "cancelled";

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  simulated: "Simulada",
  accrued: "Devengada",
  approved: "Aprobada",
  settled: "Liquidada",
  cancelled: "Cancelada",
};

/** Lenguaje explícito para cada estado: evita ambigüedad comercial. */
export const COMMISSION_STATUS_HELP: Record<CommissionStatus, string> = {
  simulated: "Esto es una estimación. Todavía no está registrado como comisión.",
  accrued: "La comisión ya fue registrada.",
  approved: "La comisión fue aprobada.",
  settled: "La comisión fue liquidada.",
  cancelled: "La comisión dejó de ser válida, pero el registro histórico permanece.",
};

export const COMMISSION_STATUS_CLASSES: Record<CommissionStatus, string> = {
  simulated: "bg-muted text-muted-foreground",
  accrued: "bg-primary/10 text-primary",
  approved: "bg-gold/15 text-gold-foreground",
  settled: "bg-secondary text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export function commissionStatusLabel(v: string | null | undefined) {
  return COMMISSION_STATUS_LABELS[(v ?? "") as CommissionStatus] ?? "—";
}

export type AccrualResult = {
  ok: boolean;
  reason?: string;
  created?: boolean;
  commission_id?: string;
  status?: CommissionStatus;
  commission_amount?: number | null;
  currency?: string;
  booking_id?: string;
  booking_status?: string;
  booking_service_id?: string;
};

export type BookingAccrualResult = {
  ok: boolean;
  reason?: string;
  booking_id?: string;
  booking_status?: string;
  processed?: number;
  created?: number;
  already_accrued?: number;
  without_agreement?: number;
  skipped?: number;
  items?: AccrualResult[];
};

/** Devenga todas las comisiones elegibles de una reserva (idempotente). */
export async function accrueBookingCommissions(bookingId: string): Promise<BookingAccrualResult> {
  const { data, error } = await supabase.rpc("accrue_booking_commissions", {
    _booking_id: bookingId,
  });
  if (error) throw error;
  return data as unknown as BookingAccrualResult;
}

/** Devenga la comisión de un único servicio (diagnóstico / casos puntuales). */
export async function accrueServiceCommission(bookingServiceId: string): Promise<AccrualResult> {
  const { data, error } = await supabase.rpc("accrue_commission", {
    _booking_service_id: bookingServiceId,
  });
  if (error) throw error;
  return data as unknown as AccrualResult;
}

/** Única vía de cambio de estado: nunca UPDATE directo desde el frontend. */
export async function setCommissionStatus(
  commissionId: string,
  to: Exclude<CommissionStatus, "settled" | "simulated" | "accrued">,
  comment?: string,
) {
  const { data, error } = await supabase.rpc("set_commission_status", {
    _commission_id: commissionId,
    _to: to,
    _comment: comment?.trim() ? comment.trim() : undefined,
  });
  if (error) throw error;
  return data as unknown as { ok: boolean; changed?: boolean; reason?: string };
}

/** Comisiones persistidas de una reserva. */
export async function listBookingCommissions(bookingId: string): Promise<Commission[]> {
  const { data, error } = await supabase
    .from("commissions")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Historial de las comisiones de una reserva (append-only, escrito por trigger). */
export async function listBookingCommissionHistory(
  commissionIds: string[],
): Promise<CommissionHistoryRow[]> {
  if (commissionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("commission_history")
    .select("*")
    .in("commission_id", commissionIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type MyCommissionRow = Commission & {
  booking: { id: string; booking_number: string | null } | null;
  service: { id: string; title: string | null } | null;
};

/**
 * Comisiones visibles para el usuario actual. El recorte real lo hace RLS:
 * un agente sólo ve las propias. No se exponen costos ni márgenes.
 */
export async function listMyCommissions(): Promise<MyCommissionRow[]> {
  const { data, error } = await supabase
    .from("commissions")
    .select(
      "id, status, commission_amount, currency, computed_at, created_at, booking_id, booking_service_id, agreement_id, rule_id, base, calc_type, calc_value, " +
        "booking:bookings(id, booking_number), service:booking_services(id, title)",
    )
    .order("computed_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as MyCommissionRow[];
}
