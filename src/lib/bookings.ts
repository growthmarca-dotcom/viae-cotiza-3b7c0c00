import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Booking = Tables<"bookings">;
export type BookingStatusEvent = Tables<"booking_status_history">;
export type BookingDocument = Tables<"booking_documents">;
export type BookingPayment = Tables<"booking_payments">;

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "reserved"
  | "voucher_issued"
  | "completed"
  | "cancelled";

/** Estados de la reserva en el orden operativo en el que avanzan. */
export const BOOKING_STATUSES: { value: BookingStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "in_progress", label: "En gestión" },
  { value: "reserved", label: "Reservada" },
  { value: "voucher_issued", label: "Voucher emitido" },
  { value: "completed", label: "Finalizada" },
  { value: "cancelled", label: "Cancelada" },
];

export function bookingStatusLabel(value: string | null) {
  return BOOKING_STATUSES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export function bookingStatusClasses(value: string | null) {
  switch (value) {
    case "confirmed":
    case "reserved":
    case "completed":
      return "bg-primary/10 text-primary border-primary/30";
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "in_progress":
    case "voucher_issued":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

// ---------------------------------------------------------------- documentos

export type BookingDocumentKind = "voucher" | "receipt" | "invoice" | "other";

export const BOOKING_DOCUMENT_KINDS: { value: BookingDocumentKind; label: string }[] = [
  { value: "voucher", label: "Voucher" },
  { value: "receipt", label: "Recibo" },
  { value: "invoice", label: "Factura" },
  { value: "other", label: "Archivo" },
];

export function documentKindLabel(value: string) {
  return BOOKING_DOCUMENT_KINDS.find((k) => k.value === value)?.label ?? value;
}

// -------------------------------------------------------------------- pagos

export type BookingPaymentKind = "deposit" | "balance" | "other";
export type BookingPaymentStatus = "pending" | "partial" | "paid" | "refunded" | "cancelled";

export const BOOKING_PAYMENT_KINDS: { value: BookingPaymentKind; label: string }[] = [
  { value: "deposit", label: "Seña" },
  { value: "balance", label: "Saldo" },
  { value: "other", label: "Otro" },
];

export const BOOKING_PAYMENT_STATUSES: { value: BookingPaymentStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "partial", label: "Parcial" },
  { value: "paid", label: "Pagado" },
  { value: "refunded", label: "Reintegrado" },
  { value: "cancelled", label: "Cancelado" },
];

export function paymentKindLabel(value: string) {
  return BOOKING_PAYMENT_KINDS.find((k) => k.value === value)?.label ?? value;
}

export function paymentStatusLabel(value: string) {
  return BOOKING_PAYMENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

// ------------------------------------------------------------------- lectura

export type BookingFilters = {
  search?: string;
  status?: BookingStatus | "all";
  includeArchived?: boolean;
};

export async function listBookings(filters: BookingFilters = {}): Promise<Booking[]> {
  let q = supabase.from("bookings").select("*").order("created_at", { ascending: false });
  if (!filters.includeArchived) q = q.eq("record_status", "active");
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Booking[];
  const term = filters.search?.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((b) =>
    [b.booking_number, b.destination, b.notes, b.provider_name]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term)),
  );
}

export async function getBooking(id: string): Promise<Booking | null> {
  const { data, error } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Booking) ?? null;
}

export async function listBookingsByClient(clientId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Booking[];
}

/** Reserva ya generada a partir de una oportunidad, si existe. */
export async function getBookingByOpportunity(opportunityId: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) throw error;
  return (data as Booking) ?? null;
}

export async function getBookingByQuotation(quotationId: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("quotation_id", quotationId)
    .maybeSingle();
  if (error) throw error;
  return (data as Booking) ?? null;
}

export async function listStatusHistory(bookingId: string): Promise<BookingStatusEvent[]> {
  const { data, error } = await supabase
    .from("booking_status_history")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookingStatusEvent[];
}

export async function listBookingDocuments(bookingId: string): Promise<BookingDocument[]> {
  const { data, error } = await supabase
    .from("booking_documents")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BookingDocument[];
}

export async function listBookingPayments(bookingId: string): Promise<BookingPayment[]> {
  const { data, error } = await supabase
    .from("booking_payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookingPayment[];
}

// ----------------------------------------------------------------- escritura

/**
 * Origen obligatorio de una reserva: siempre nace de una oportunidad
 * o de una cotización, nunca desde cero.
 */
export type BookingOrigin = {
  opportunityId?: string | null;
  quotationId?: string | null;
};

export type BookingInput = {
  client_id: string;
  assigned_agent_id: string | null;
  status: BookingStatus;
  travel_start: string | null;
  travel_end: string | null;
  destination: string | null;
  amount: number;
  currency: string;
  exchange_rate: number | null;
  notes: string | null;
};

export async function createBooking(origin: BookingOrigin, input: BookingInput): Promise<string> {
  if (!origin.opportunityId && !origin.quotationId) {
    throw new Error("Una reserva sólo puede crearse desde una oportunidad o una cotización.");
  }
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      ...input,
      user_id: uid,
      opportunity_id: origin.opportunityId ?? null,
      quotation_id: origin.quotationId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateBooking(id: string, input: Partial<BookingInput>) {
  const { error } = await supabase.from("bookings").update(input).eq("id", id);
  if (error) throw error;
}

/** Las reservas no se eliminan: cambian de estado. */
export async function setBookingStatus(id: string, status: BookingStatus) {
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setBookingProvider(
  id: string,
  provider: { provider_name: string | null; provider_reference: string | null; provider_notes: string | null },
) {
  const { error } = await supabase.from("bookings").update(provider).eq("id", id);
  if (error) throw error;
}

export async function archiveBooking(id: string, archived: boolean) {
  const { error } = await supabase
    .from("bookings")
    .update({ record_status: archived ? "archived" : "active" })
    .eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------- estadísticas

export type BookingStats = {
  pending: number;
  confirmed: number;
  cancelled: number;
  travelsThisMonth: number;
  totalValue: number;
  excluded: number;
};

const CONFIRMED = new Set(["confirmed", "reserved", "voucher_issued", "completed"]);

/**
 * Estadísticas del módulo. `convert` normaliza cada importe a la moneda de
 * análisis y devuelve null cuando no se puede convertir sin mezclar monedas.
 */
export function computeBookingStats(
  bookings: Booking[],
  convert: (amount: number, currency: string, rate: number | null) => number | null,
): BookingStats {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const converted = bookings
    .filter((b) => b.status !== "cancelled")
    .map((b) => convert(Number(b.amount ?? 0), b.currency, b.exchange_rate));

  return {
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => CONFIRMED.has(b.status)).length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    travelsThisMonth: bookings.filter((b) => {
      if (!b.travel_start || b.status === "cancelled") return false;
      const d = new Date(`${b.travel_start}T00:00:00`);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length,
    totalValue: converted.reduce((acc: number, v) => acc + (v ?? 0), 0),
    excluded: converted.filter((v) => v == null).length,
  };
}

/* ------------------------------------------------------------------------- *
 * Booking Organization Ownership (v1.10.7.2.1.3)
 *
 * `bookings.organization_id` = organización comercial PROPIETARIA de la
 * operación turística. NO es el proveedor, prestador, empresa externa ni la
 * organización del servicio (esas viven en booking_services.provider_id /
 * transport_services.provider_id / providers.organization_id).
 *
 * Esta fase solo expone los tipos y el contrato de resolución: no hay backfill,
 * no hay triggers y no cambió ninguna política RLS.
 * ------------------------------------------------------------------------- */

export type BookingOrganizationSource =
  | "explicit"
  | "agent_membership"
  | "creator_membership"
  | "none";

export type BookingOrganizationConfidence = "high" | "medium" | "ambiguous" | "none";

export type BookingOrganizationError =
  | "organization_not_found"
  | "ambiguous_organization"
  | "no_organization_found";

/** Resultado de `resolve_booking_organization(_creator_user_id, _agent_id, _explicit_org_id)`. */
export type BookingOrganizationResolution = {
  organization_id: string | null;
  source: BookingOrganizationSource;
  confidence: BookingOrganizationConfidence;
  error: BookingOrganizationError | null;
  /** Presente solo cuando `error === "ambiguous_organization"`. */
  candidates?: string[];
};

export type BookingOrganizationValidationError =
  | "booking_not_found"
  | "organization_missing"
  | "organization_not_found"
  | "organization_inactive"
  | "organization_is_provider_scope";

/** Resultado de `validate_booking_organization(_booking_id)`. */
export type BookingOrganizationValidation = {
  valid: boolean;
  organization_id?: string | null;
  organization_status?: string;
  provider_semantics_conflict?: boolean;
  error: BookingOrganizationValidationError | null;
};

export const BOOKING_ORG_SOURCE_LABELS: Record<BookingOrganizationSource, string> = {
  explicit: "Organización indicada explícitamente",
  agent_membership: "Membresía del agente asignado",
  creator_membership: "Membresía del usuario creador",
  none: "Sin origen determinado",
};

export const BOOKING_ORG_CONFIDENCE_LABELS: Record<BookingOrganizationConfidence, string> = {
  high: "Alta",
  medium: "Media",
  ambiguous: "Ambigua",
  none: "Sin datos",
};

/** `true` cuando la resolución es apta para asignarse sin intervención humana. */
export function isBookingOrganizationResolved(r: BookingOrganizationResolution): boolean {
  return !!r.organization_id && r.error === null;
}
