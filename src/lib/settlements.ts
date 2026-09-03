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
  documentType?: "invoice" | "other" | "credit_note" | "debit_note";
  adjustmentId?: string;
  commissionId?: string;
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
    _adjustment_id: input.adjustmentId ?? undefined,
    _commission_id: input.commissionId ?? undefined,
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

// =====================================================================
// Fase C1.3 — Conciliación interna, ajustes, saldos y notas de crédito/débito.
//
// Nada de esto edita la historia: la comisión, la liquidación, el ítem, la
// factura aprobada y el pago siguen siendo inmutables. Una diferencia se
// corrige SIEMPRE con un movimiento nuevo y trazable.
// =====================================================================

export type Adjustment = Tables<"commission_adjustments">;
export type AdjustmentApplication = Tables<"commission_adjustment_applications">;
export type AdjustmentHistoryRow = Tables<"commission_adjustment_history">;

export type ReconciliationStatus = "pending" | "reconciled" | "discrepancy";
export type AdjustmentType = "credit" | "debit";
export type AdjustmentStatus = "pending_approval" | "approved" | "rejected";
export type NoteDocumentType = "credit_note" | "debit_note";

export const RECONCILIATION_LABELS: Record<ReconciliationStatus, string> = {
  pending: "Pendiente de conciliación",
  reconciled: "Conciliada",
  discrepancy: "Discrepancia",
};

export const RECONCILIATION_CLASSES: Record<ReconciliationStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  reconciled: "bg-gold/15 text-gold-foreground",
  discrepancy: "bg-destructive/10 text-destructive",
};

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  credit: "Crédito (reduce lo que ViaE debe)",
  debit: "Débito (aumenta lo que ViaE debe)",
};

export const ADJUSTMENT_STATUS_LABELS: Record<AdjustmentStatus, string> = {
  pending_approval: "Pendiente de aprobación",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const ADJUSTMENT_STATUS_CLASSES: Record<AdjustmentStatus, string> = {
  pending_approval: "bg-primary/10 text-primary",
  approved: "bg-gold/15 text-gold-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export const ADJUSTMENT_REASONS = [
  { value: "commission_calculation_error", label: "Error de cálculo de comisión" },
  { value: "cancellation", label: "Cancelación" },
  { value: "refund", label: "Reintegro" },
  { value: "duplicate_commission", label: "Comisión duplicada" },
  { value: "rounding_difference", label: "Diferencia de redondeo" },
  { value: "administrative_correction", label: "Corrección administrativa" },
  { value: "other", label: "Otro (requiere descripción)" },
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]["value"];

export function adjustmentReasonLabel(v: string | null | undefined) {
  return ADJUSTMENT_REASONS.find((r) => r.value === v)?.label ?? "—";
}

export function reconciliationLabel(v: string | null | undefined) {
  return RECONCILIATION_LABELS[(v ?? "pending") as ReconciliationStatus] ?? "—";
}

export const NOTE_TYPE_LABELS: Record<string, string> = {
  invoice: "Factura",
  credit_note: "Nota de crédito",
  debit_note: "Nota de débito",
  other: "Documento",
};

export function documentTypeLabel(v: string | null | undefined) {
  return NOTE_TYPE_LABELS[v ?? "other"] ?? "Documento";
}

/** Importe final a pagar: total original + débitos - créditos ± saldos aplicados. */
export async function getPayableAmount(settlementId: string): Promise<number> {
  const { data, error } = await supabase.rpc("settlement_payable_amount", {
    _settlement_id: settlementId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Conciliación interna: no toca el pago, sólo registra su verificación. */
export async function reconcileSettlementPayment(
  settlementId: string,
  status: ReconciliationStatus,
  notes?: string,
) {
  const { data, error } = await supabase.rpc("reconcile_settlement_payment", {
    _settlement_id: settlementId,
    _status: status,
    _notes: notes?.trim() ? notes.trim() : undefined,
  });
  if (error) throw error;
  return data as unknown as {
    ok: boolean;
    reason?: string;
    changed?: boolean;
    reconciliation_status?: string;
    issues?: string[];
  };
}

export type CreateAdjustmentInput = {
  settlementId?: string;
  commissionId?: string;
  adjustmentType: AdjustmentType;
  amount: number;
  reason: AdjustmentReason;
  notes?: string;
  currency?: string;
  idempotencyKey?: string;
};

export async function createAdjustment(input: CreateAdjustmentInput) {
  const { data, error } = await supabase.rpc("create_commission_adjustment", {
    _adjustment_type: input.adjustmentType,
    _amount: input.amount,
    _reason: input.reason,
    _settlement_id: input.settlementId ?? undefined,
    _commission_id: input.commissionId ?? undefined,
    _currency: input.currency ?? undefined,
    _notes: input.notes?.trim() ? input.notes.trim() : undefined,
    _idempotency_key: input.idempotencyKey ?? undefined,
  });
  if (error) throw error;
  return data as unknown as {
    ok: boolean;
    reason?: string;
    created?: boolean;
    adjustment_id?: string;
    status?: string;
    affects_payment?: boolean;
    payable?: number;
  };
}

export async function reviewAdjustment(id: string, approve: boolean, reason?: string) {
  const { data, error } = await supabase.rpc("review_commission_adjustment", {
    _adjustment_id: id,
    _approve: approve,
    _reason: reason?.trim() ? reason.trim() : undefined,
  });
  if (error) throw error;
  return data as unknown as {
    ok: boolean;
    reason?: string;
    changed?: boolean;
    status?: string;
    creates_balance?: boolean;
    payable?: number;
  };
}

/** Aplicación manual y trazable de un saldo a una liquidación futura. */
export async function applyAdjustmentBalance(
  adjustmentId: string,
  settlementId: string,
  amount: number,
) {
  const { data, error } = await supabase.rpc("apply_commission_adjustment_balance", {
    _adjustment_id: adjustmentId,
    _settlement_id: settlementId,
    _amount: amount,
  });
  if (error) throw error;
  return data as unknown as {
    ok: boolean;
    reason?: string;
    changed?: boolean;
    application_id?: string;
    remaining?: number;
    payable?: number;
  };
}

export async function listSettlementAdjustments(settlementId: string): Promise<Adjustment[]> {
  const { data, error } = await supabase
    .from("commission_adjustments")
    .select("*")
    .eq("settlement_id", settlementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSettlementApplications(
  settlementId: string,
): Promise<AdjustmentApplication[]> {
  const { data, error } = await supabase
    .from("commission_adjustment_applications")
    .select("*")
    .eq("settlement_id", settlementId)
    .order("applied_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type AdjustmentBalance = {
  adjustment_id: string;
  organization_id: string | null;
  beneficiary_type: string;
  beneficiary_id: string;
  currency: string;
  adjustment_type: string;
  amount: number;
  origin_settlement_id: string | null;
  origin_commission_id: string | null;
  reason: string;
  created_at: string;
  amount_applied: number;
  remaining_amount: number;
};

/**
 * Saldos disponibles del mismo beneficiario y moneda. Nunca se compensan
 * monedas distintas: un saldo USD sólo aplica a liquidaciones USD.
 */
export async function listAvailableBalances(filters: {
  beneficiaryType: string;
  beneficiaryId: string;
  currency: string;
}): Promise<AdjustmentBalance[]> {
  const { data, error } = await supabase
    .from("commission_adjustment_balances")
    .select("*")
    .eq("beneficiary_type", filters.beneficiaryType as "agent" | "organization" | "viae")
    .eq("beneficiary_id", filters.beneficiaryId)
    .eq("currency", filters.currency)
    .gt("remaining_amount", 0)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as AdjustmentBalance[];
}

export async function listAdjustmentHistory(
  settlementId: string,
): Promise<AdjustmentHistoryRow[]> {
  const { data, error } = await supabase
    .from("commission_adjustment_history")
    .select("*")
    .eq("settlement_id", settlementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const ADJUSTMENT_HISTORY_LABELS: Record<string, string> = {
  adjustment_created: "Ajuste creado",
  adjustment_approved: "Ajuste aprobado",
  adjustment_rejected: "Ajuste rechazado",
  balance_created: "Saldo generado",
  balance_applied: "Saldo aplicado",
  reconciliation_updated: "Conciliación actualizada",
  discrepancy_detected: "Discrepancia detectada",
  note_submitted: "Nota presentada",
  note_approved: "Nota aprobada",
  note_rejected: "Nota rechazada",
};

export const RECONCILIATION_ISSUE_LABELS: Record<string, string> = {
  currency_mismatch: "La moneda del pago no coincide con la de la liquidación.",
  amount_mismatch: "El importe pagado no coincide con el importe final.",
  approved_invoice_missing: "No hay una factura aprobada.",
  settlement_not_settled: "La liquidación no está marcada como pagada.",
};

Object.assign(SETTLEMENT_REASONS, {
  invalid_reconciliation_status: "Estado de conciliación no válido.",
  payment_not_found: "Esta liquidación no tiene un pago registrado.",
  coherence_failed: "El pago no coincide con la liquidación: revisá las diferencias.",
  invalid_adjustment_type: "Tipo de ajuste no válido.",
  invalid_reason: "Motivo de ajuste no válido.",
  notes_required: "Si el motivo es «Otro», la descripción es obligatoria.",
  link_required: "El ajuste tiene que referenciar una liquidación o una comisión.",
  commission_not_found: "La comisión no existe.",
  beneficiary_required: "El ajuste necesita un beneficiario.",
  credit_exceeds_payable: "El crédito no puede superar el importe a pagar.",
  adjustment_not_applicable: "Ese ajuste no genera saldo aplicable.",
  settlement_not_found: "La liquidación no existe.",
  beneficiary_mismatch: "El saldo pertenece a otro beneficiario.",
  settlement_already_paid: "Esa liquidación ya fue pagada.",
  same_settlement: "El saldo no se aplica a la liquidación que lo originó.",
  exceeds_balance: "No podés aplicar más saldo del disponible.",
  exceeds_settlement: "No podés aplicar más que el importe de la liquidación.",
  adjustment_pending_approval: "Hay un ajuste pendiente de aprobación: definí el importe final.",
  nothing_to_pay: "Con los ajustes aplicados no queda importe a pagar.",
  adjustment_required: "La nota tiene que estar vinculada a un ajuste.",
  adjustment_not_found: "El ajuste no existe.",
  adjustment_settlement_mismatch: "El ajuste pertenece a otra liquidación.",
  note_type_mismatch: "El tipo de nota no coincide con el tipo de ajuste.",
  note_already_present: "Ya hay una nota presentada o aprobada para ese ajuste.",
});

/** Signo económico determinado por el tipo: nunca se guardan importes negativos. */
export function adjustmentSignedAmount(a: { adjustment_type: string; amount: number | string }) {
  const value = Number(a.amount ?? 0);
  return a.adjustment_type === "debit" ? value : -value;
}
