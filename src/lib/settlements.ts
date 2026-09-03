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

// =====================================================================
// Fase C1.2 — Facturación, documentación y registro de pago.
//
// No se toca el motor de comisiones ni la generación de C1.1: esta capa
// solamente adjunta documentación a una liquidación existente, la somete a
// revisión administrativa y registra el pago completo hecho por fuera.
// =====================================================================

export type SettlementDocument = Tables<"commission_settlement_documents">;
export type SettlementPayment = Tables<"commission_settlement_payments">;

export type DocumentStatus = "pending_review" | "approved" | "rejected";

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending_review: "Pendiente de revisión",
  approved: "Aprobada",
  rejected: "Rechazada — pendiente de nueva presentación",
};

export const DOCUMENT_STATUS_CLASSES: Record<DocumentStatus, string> = {
  pending_review: "bg-primary/10 text-primary",
  approved: "bg-gold/15 text-gold-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Transferencia bancaria" },
  { value: "cash", label: "Efectivo" },
  { value: "other", label: "Otro" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export function paymentMethodLabel(v: string | null | undefined) {
  return PAYMENT_METHODS.find((m) => m.value === v)?.label ?? "—";
}

export const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

export async function listSettlementDocuments(
  settlementId: string,
): Promise<SettlementDocument[]> {
  const { data, error } = await supabase
    .from("commission_settlement_documents")
    .select("*")
    .eq("settlement_id", settlementId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSettlementPayment(
  settlementId: string,
): Promise<SettlementPayment | null> {
  const { data, error } = await supabase
    .from("commission_settlement_payments")
    .select("*")
    .eq("settlement_id", settlementId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export type SubmitInvoiceInput = {
  settlementId: string;
  filePath: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  amount?: number;
  currency?: string;
  invoiceKind?: string;
  notes?: string;
  documentType?: "invoice" | "other";
};

/** Carga de factura/documento. La valida la RPC, no el frontend. */
export async function submitSettlementInvoice(input: SubmitInvoiceInput) {
  const { data, error } = await supabase.rpc("submit_settlement_invoice", {
    _settlement_id: input.settlementId,
    _file_path: input.filePath,
    _file_name: input.fileName ?? undefined,
    _mime_type: input.mimeType ?? undefined,
    _file_size: input.fileSize ?? undefined,
    _invoice_number: input.invoiceNumber?.trim() ? input.invoiceNumber.trim() : undefined,
    _invoice_date: input.invoiceDate ?? undefined,
    _amount: input.amount ?? undefined,
    _currency: input.currency ?? undefined,
    _invoice_kind: input.invoiceKind?.trim() ? input.invoiceKind.trim() : undefined,
    _notes: input.notes?.trim() ? input.notes.trim() : undefined,
    _document_type: input.documentType ?? "invoice",
  });
  if (error) throw error;
  return data as unknown as { ok: boolean; reason?: string; document_id?: string; status?: string };
}

/** Revisión administrativa: aprobar o rechazar con motivo. */
export async function reviewSettlementDocument(
  documentId: string,
  approve: boolean,
  reason?: string,
) {
  const { data, error } = await supabase.rpc("review_settlement_document", {
    _document_id: documentId,
    _approve: approve,
    _reason: reason?.trim() ? reason.trim() : undefined,
  });
  if (error) throw error;
  return data as unknown as {
    ok: boolean;
    reason?: string;
    document_status?: string;
    status?: string;
  };
}

export type RecordPaymentInput = {
  settlementId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  paymentProofPath?: string;
  notes?: string;
};

/**
 * Registro del pago: completo y exacto. No hay pagos parciales ni múltiples;
 * la RPC rechaza cualquier importe distinto al total de la liquidación.
 */
export async function recordSettlementPayment(input: RecordPaymentInput) {
  const { data, error } = await supabase.rpc("record_commission_settlement_payment", {
    _settlement_id: input.settlementId,
    _amount: input.amount,
    _currency: input.currency,
    _payment_date: input.paymentDate,
    _payment_method: input.paymentMethod,
    _payment_reference: input.paymentReference?.trim() ? input.paymentReference.trim() : undefined,
    _payment_proof_path: input.paymentProofPath ?? undefined,
    _notes: input.notes?.trim() ? input.notes.trim() : undefined,
  });
  if (error) throw error;
  return data as unknown as { ok: boolean; reason?: string; payment_id?: string; status?: string };
}

export const SETTLEMENT_REASONS: Record<string, string> = {
  forbidden: "No tenés permisos para esta acción.",
  not_authenticated: "Tu sesión expiró. Volvé a ingresar.",
  not_found: "La liquidación no existe.",
  invalid_transition: "Esa transición de estado no está permitida.",
  status_driven_by_invoice: "Ese estado lo define la revisión de la factura.",
  settlement_requires_payment: "Para marcarla pagada hay que registrar el pago.",
  settlement_not_open_for_invoice: "La liquidación no admite facturas en este estado.",
  invoice_already_present: "Ya hay una factura presentada o aprobada.",
  currency_required: "Indicá la moneda de la factura.",
  currency_mismatch: "La moneda de la factura debe coincidir con la de la liquidación.",
  invalid_amount: "El importe de la factura no es válido.",
  file_required: "Adjuntá el archivo de la factura.",
  invalid_mime_type: "Formato no permitido: sólo PDF, JPG o PNG.",
  invalid_extension: "La extensión del archivo no coincide con su tipo.",
  file_too_large: "El archivo supera los 5 MB.",
  empty_file: "El archivo está vacío.",
  document_already_reviewed: "Ese documento ya fue revisado.",
  reason_required: "Indicá el motivo del rechazo.",
  approved_invoice_required: "Hace falta una factura aprobada para registrar el pago.",
  settlement_not_ready_for_payment: "La liquidación todavía no está lista para pago.",
  payment_already_recorded: "Esta liquidación ya tiene un pago registrado.",
  amount_mismatch: "El importe debe ser exactamente igual al total de la liquidación.",
  payment_date_required: "Indicá la fecha del pago.",
  invalid_payment_method: "Medio de pago no válido.",
  beneficiary_not_authorized: "El beneficiario no está autorizado a recibir liquidaciones.",
  beneficiary_not_found: "El beneficiario no existe.",
  sign_failed: "No se pudo abrir el archivo.",
};

export function settlementReason(reason?: string | null) {
  if (!reason) return "No se pudo completar la operación.";
  return SETTLEMENT_REASONS[reason] ?? reason;
}

/** Liquidaciones donde el usuario actual es beneficiario (el recorte lo hace RLS). */
export async function listMySettlements(): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from("commission_settlements")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}
