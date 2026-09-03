import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Liquidaciones de comisiones — Fase C1.1 (NÚCLEO).
 *
 * Esta capa NO calcula comisiones: consume las comisiones ya devengadas y
 * aprobadas por el motor (resolve_agreement + compute_commission + accrue_*).
 * La generación, las transiciones de estado y las notas pasan siempre por RPC
 * administrativas; el frontend nunca inserta ni borra liquidaciones.
 *
 * Fuera de alcance (C1.2): facturas, documentación fiscal, registro de pagos y
 * comprobantes. Por eso el estado `settled` existe en el modelo pero todavía
 * no puede alcanzarse.
 */

export type Settlement = Tables<"commission_settlements">;
export type SettlementItem = Tables<"commission_settlement_items">;
export type SettlementHistoryRow = Tables<"commission_settlement_history">;

export type SettlementStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "invoice_pending"
  | "invoice_review"
  | "ready_for_payment"
  | "settled";
export type BeneficiaryType = "organization" | "agent";

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  draft: "Borrador",
  pending_review: "En revisión",
  approved: "Aprobada",
  invoice_pending: "Factura pendiente",
  invoice_review: "Factura en revisión",
  ready_for_payment: "Lista para pago",
  settled: "Pagada",
};

export const SETTLEMENT_STATUS_HELP: Record<SettlementStatus, string> = {
  draft: "Generada automáticamente. Todavía no fue revisada.",
  pending_review: "Enviada a revisión administrativa.",
  approved: "Aprobada para liquidar. Su detalle ya no se modifica.",
  invoice_pending: "Falta la factura del beneficiario para poder pagar.",
  invoice_review: "Factura presentada, pendiente de revisión administrativa.",
  ready_for_payment: "Factura aprobada. Se puede registrar el pago.",
  settled: "Pago registrado. La liquidación es histórica.",
};

export const SETTLEMENT_STATUS_CLASSES: Record<SettlementStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-primary/10 text-primary",
  approved: "bg-gold/15 text-gold-foreground",
  invoice_pending: "bg-destructive/10 text-destructive",
  invoice_review: "bg-primary/10 text-primary",
  ready_for_payment: "bg-gold/15 text-gold-foreground",
  settled: "bg-secondary text-muted-foreground",
};

export function settlementStatusLabel(v: string | null | undefined) {
  return SETTLEMENT_STATUS_LABELS[(v ?? "") as SettlementStatus] ?? "—";
}

export function beneficiaryTypeLabel(v: string | null | undefined) {
  return v === "agent" ? "Agente" : v === "organization" ? "Organización" : "—";
}

/** Período legible: las liquidaciones nunca mezclan monedas ni beneficiarios. */
export function periodLabel(from: string, to: string) {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  const year = new Date(`${to}T00:00:00`).getFullYear();
  return `${fmt(from)} — ${fmt(to)} ${year}`;
}

export type GenerateResult = {
  ok: boolean;
  reason?: string;
  as_of?: string;
  settlements_created?: number;
  items_created?: number;
  skipped?: number;
};

/** Genera las liquidaciones elegibles. Idempotente: no duplica comisiones. */
export async function generateSettlements(asOf?: string): Promise<GenerateResult> {
  const { data, error } = await supabase.rpc("generate_commission_settlements", {
    _as_of: asOf && asOf.trim() ? asOf : undefined,
  });
  if (error) throw error;
  return data as unknown as GenerateResult;
}

/** Única vía de cambio de estado: nunca UPDATE directo desde el frontend. */
export async function setSettlementStatus(
  id: string,
  to: Exclude<SettlementStatus, "settled" | "invoice_review" | "ready_for_payment">,
  comment?: string,
) {
  const { data, error } = await supabase.rpc("set_settlement_status", {
    _settlement_id: id,
    _to: to,
    _comment: comment?.trim() ? comment.trim() : undefined,
  });
  if (error) throw error;
  return data as unknown as { ok: boolean; changed?: boolean; reason?: string; from?: string };
}

export async function setSettlementNotes(id: string, notes: string) {
  const { data, error } = await supabase.rpc("set_settlement_notes", {
    _settlement_id: id,
    _notes: notes,
  });
  if (error) throw error;
  return data as unknown as { ok: boolean; reason?: string };
}

export type SettlementFilters = {
  status?: SettlementStatus | "all";
  currency?: string | "all";
  beneficiaryType?: BeneficiaryType | "all";
};

export async function listSettlements(filters: SettlementFilters = {}): Promise<Settlement[]> {
  let query = supabase
    .from("commission_settlements")
    .select("*")
    .order("period_start", { ascending: false });

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.currency && filters.currency !== "all") query = query.eq("currency", filters.currency);
  if (filters.beneficiaryType && filters.beneficiaryType !== "all")
    query = query.eq("beneficiary_type", filters.beneficiaryType);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getSettlement(id: string): Promise<Settlement | null> {
  const { data, error } = await supabase
    .from("commission_settlements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export type SettlementItemRow = SettlementItem & {
  commission: {
    id: string;
    status: string | null;
    base: string | null;
    calc_type: string | null;
    calc_value: number | null;
    booking_id: string | null;
    booking: { id: string; booking_number: string | null } | null;
    service: { id: string; title: string | null } | null;
  } | null;
};

export async function listSettlementItems(settlementId: string): Promise<SettlementItemRow[]> {
  const { data, error } = await supabase
    .from("commission_settlement_items")
    .select(
      "*, commission:commissions(id, status, base, calc_type, calc_value, booking_id, " +
        "booking:bookings(id, booking_number), service:booking_services(id, title))",
    )
    .eq("settlement_id", settlementId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as SettlementItemRow[];
}

export async function listSettlementHistory(
  settlementId: string,
): Promise<SettlementHistoryRow[]> {
  const { data, error } = await supabase
    .from("commission_settlement_history")
    .select("*")
    .eq("settlement_id", settlementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Nombres de beneficiarios (organizaciones y agentes) para mostrar en pantalla. */
export async function fetchBeneficiaryNames(
  rows: { beneficiary_type: string; beneficiary_id: string }[],
): Promise<Record<string, string>> {
  const orgIds = [
    ...new Set(rows.filter((r) => r.beneficiary_type === "organization").map((r) => r.beneficiary_id)),
  ];
  const agentIds = [
    ...new Set(rows.filter((r) => r.beneficiary_type === "agent").map((r) => r.beneficiary_id)),
  ];
  const out: Record<string, string> = {};

  if (orgIds.length) {
    const { data } = await supabase
      .from("organizations")
      .select("id, trade_name")
      .in("id", orgIds);
    for (const o of data ?? []) out[o.id] = o.trade_name ?? "Organización";
  }
  if (agentIds.length) {
    const { data } = await supabase
      .from("agents")
      .select("id, first_name, last_name")
      .in("id", agentIds);
    for (const a of data ?? [])
      out[a.id] = [a.first_name, a.last_name].filter(Boolean).join(" ") || "Agente";
  }
  return out;
}

/** Totales SIEMPRE agrupados por moneda: nunca se suman monedas distintas. */
export function settlementTotals(rows: Settlement[]) {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    if (r.status === "settled") continue;
    const acc = map.get(r.currency) ?? { total: 0, count: 0 };
    acc.total = Math.round((acc.total + Number(r.total_commission_amount ?? 0)) * 100) / 100;
    acc.count += 1;
    map.set(r.currency, acc);
  }
  return [...map.entries()]
    .map(([currency, v]) => ({ currency, ...v }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
