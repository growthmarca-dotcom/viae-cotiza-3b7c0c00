import { supabase } from "@/integrations/supabase/client";
import { resolveMyOrganizationId } from "@/lib/tenant";
import { getExchangeRate } from "@/lib/money";
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
  /** v1.10.9.1 — Smart Quote origen (motor de cálculo), si existe. */
  smartQuoteId?: string | null;
};

/**
 * Intervención 5 — Economía / Tipo de cambio.
 *
 * Sello del tipo de cambio aplicado en la conversión. La tasa se resuelve una
 * sola vez, en el momento de crear la reserva, y queda guardada en la reserva y
 * en sus servicios (`applied_exchange_rate`, `applied_rate_date`,
 * `applied_rate_source`). Por eso una reserva NO cambia de importe si más
 * adelante se carga un tipo de cambio distinto.
 *
 * Prioridad de la tasa:
 * 1. `manual`   — la tasa cargada por el agente en la cotización/reserva.
 * 2. `snapshot` — la tasa vigente del Financial Core (`currency_rate_at`).
 * 3. sin tasa   — cuando la moneda ya es ARS o no hay cotización cargada.
 */
export type AppliedRateStamp = {
  applied_exchange_rate: number | null;
  applied_rate_date: string | null;
  applied_rate_source: "manual" | "snapshot" | "inherited" | null;
};

export async function resolveAppliedRate(
  currency: string,
  manualRate: number | null | undefined,
): Promise<AppliedRateStamp> {
  const today = new Date().toISOString().slice(0, 10);
  const manual = manualRate != null && Number(manualRate) > 0 ? Number(manualRate) : null;
  if (manual) {
    return {
      applied_exchange_rate: manual,
      applied_rate_date: today,
      applied_rate_source: "manual",
    };
  }
  const iso = (currency || "").toUpperCase();
  if (!iso || iso === "ARS") {
    return { applied_exchange_rate: null, applied_rate_date: null, applied_rate_source: null };
  }
  try {
    const rate = await getExchangeRate(iso, "ARS");
    if (rate) {
      return {
        applied_exchange_rate: rate,
        applied_rate_date: today,
        applied_rate_source: "snapshot",
      };
    }
  } catch {
    // Sin cotización cargada la reserva queda sin sello: no se inventa una tasa.
  }
  return { applied_exchange_rate: null, applied_rate_date: null, applied_rate_source: null };
}

export type BookingInput = {
  client_id: string;
  /**
   * Organización comercial propietaria (v1.10.7.2.1.4). Opcional: si no se
   * envía, la base la resuelve desde el agente asignado o la única
   * organización activa del creador. Si hay ambigüedad, se bloquea el alta.
   */
  organization_id?: string;
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
  if (!origin.opportunityId && !origin.quotationId && !origin.smartQuoteId) {
    throw new Error(
      "Una reserva sólo puede crearse desde una oportunidad, una cotización o una cotización inteligente.",
    );
  }
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");

  // Idempotencia de la conversión: una cotización genera una sola reserva.
  // Si ya existe, se devuelve la existente en lugar de duplicar el contenido.
  if (origin.quotationId) {
    const existing = await getBookingByQuotation(origin.quotationId);
    if (existing) {
      await copyQuotationContentToBooking(origin.quotationId, existing.id, uid, {
        applied_exchange_rate: existing.applied_exchange_rate ?? null,
        applied_rate_date: existing.applied_rate_date ?? null,
        applied_rate_source: existing.applied_exchange_rate != null ? "inherited" : null,
      });
      return existing.id;
    }
  }


  let opportunityId = origin.opportunityId ?? null;
  let organizationId = input.organization_id ?? null;
  let clientId = input.client_id;
  let agentId = input.assigned_agent_id;
  let smartQuoteId = origin.smartQuoteId ?? null;

  // Conversión cotización -> reserva: la reserva hereda el contexto comercial
  // completo de la cotización (v1.10.7.2.2). Sin pérdida de contexto.
  if (origin.quotationId) {
    const { data: q } = await supabase
      .from("quotations")
      .select("opportunity_id, organization_id, client_id, smart_quote_id, status")
      .eq("id", origin.quotationId)
      .maybeSingle();
    // Intervención 7: sólo una cotización aceptada puede convertirse en reserva.
    if (q && q.status !== "accepted") {
      throw new Error(
        "Sólo una cotización aceptada puede convertirse en reserva. Estado actual: " +
          String(q.status),
      );
    }
    if (q) {
      opportunityId = opportunityId ?? q.opportunity_id ?? null;
      organizationId = organizationId ?? q.organization_id ?? null;
      clientId = clientId || (q.client_id ?? clientId);
      smartQuoteId = smartQuoteId ?? q.smart_quote_id ?? null;
    }
  }

  // Origen Smart Quote (v1.10.9.1): completa contexto comercial faltante.
  if (smartQuoteId) {
    const { data: sq } = await supabase
      .from("smart_quotes")
      .select("opportunity_id, organization_id, client_id, agent_id")
      .eq("id", smartQuoteId)
      .maybeSingle();
    if (sq) {
      opportunityId = opportunityId ?? sq.opportunity_id ?? null;
      organizationId = organizationId ?? sq.organization_id ?? null;
      clientId = clientId || (sq.client_id ?? clientId);
      agentId = agentId ?? sq.agent_id ?? null;
    }
  }

  // Origen oportunidad: hereda cliente y agente asignado si no vinieron.
  if (opportunityId) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("client_id, assigned_agent_id")
      .eq("id", opportunityId)
      .maybeSingle();
    if (opp) {
      clientId = clientId || opp.client_id;
      agentId = agentId ?? opp.assigned_agent_id ?? null;
    }
  }

  const stamp = await resolveAppliedRate(input.currency, input.exchange_rate);

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      ...input,
      ...stamp,
      client_id: clientId,
      assigned_agent_id: agentId,
      organization_id: await resolveMyOrganizationId(organizationId),
      user_id: uid,
      opportunity_id: opportunityId,
      quotation_id: origin.quotationId ?? null,
      smart_quote_id: smartQuoteId,
    })
    .select("id")
    .single();
  if (error) throw new Error(bookingCreateErrorMessage(error));
  const bookingId = data.id as string;

  // La conversión traslada el contenido comercial, no sólo la cabecera:
  // quotation_items -> booking_services y titular -> booking_passengers.
  if (origin.quotationId) {
    await copyQuotationContentToBooking(origin.quotationId, bookingId, uid, stamp);
  }
  return bookingId;
}

/** Categoría de `quotation_items` -> tipo de servicio operativo. */
const ITEM_CATEGORY_TO_SERVICE_KIND: Record<string, string> = {
  accommodation: "accommodation",
  excursion: "excursion",
  vehicle_rental: "car_rental",
  transfer: "transfer",
  insurance: "insurance",
  flight: "flight",
  other: "other",
};

/**
 * Traslado idempotente del contenido de la cotización a la reserva. Si la
 * reserva ya tiene servicios o pasajeros, no duplica nada.
 */
async function copyQuotationContentToBooking(
  quotationId: string,
  bookingId: string,
  uid: string,
  /** Tasa sellada de la reserva: los servicios la heredan tal cual. */
  stamp?: AppliedRateStamp,
): Promise<void> {
  const [{ data: items }, { data: quotation }, { count: existingServices }, { count: existingPax }] =
    await Promise.all([
      supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotationId)
        .order("position", { ascending: true }),
      supabase
        .from("quotations")
        .select(
          "guest_first_name, guest_last_name, guest_email, guest_whatsapp, currency, organization_id, pax_count",
        )
        .eq("id", quotationId)
        .maybeSingle(),

      supabase
        .from("booking_services")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", bookingId),
      supabase
        .from("booking_passengers")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", bookingId),
    ]);

  if ((items ?? []).length > 0 && !existingServices) {
    const rows = (items ?? []).map((i) => ({
      booking_id: bookingId,
      user_id: uid,
      kind: (ITEM_CATEGORY_TO_SERVICE_KIND[i.category as string] ?? "other") as never,
      title: (i.title as string) || "Servicio",
      provider_name: (i.provider_name as string | null) ?? null,
      service_date: (i.service_date as string | null) ?? null,
      notes: (i.notes as string | null) ?? (i.description as string | null) ?? null,
      organization_id: quotation?.organization_id ?? null,
      sale_amount:
        Number(i.quantity ?? 0) * Number(i.unit_amount ?? 0) + Number(i.taxes ?? 0),
      sale_currency: quotation?.currency ?? null,
      applied_exchange_rate: stamp?.applied_exchange_rate ?? null,
      applied_rate_date: stamp?.applied_rate_date ?? null,
      applied_rate_source:
        stamp?.applied_exchange_rate != null ? ("inherited" as const) : null,
    }));
    const { error } = await supabase.from("booking_services").insert(rows as never);
    if (error) throw error;
  }

  // Titular del viaje + acompañantes según el `pax_count` cotizado.
  // Los acompañantes nacen como marcadores nominativos para que la operación
  // sepa cuánta gente viaja; los datos reales se completan en el expediente.
  const firstName = (quotation?.guest_first_name ?? "").trim();
  const lastName = (quotation?.guest_last_name ?? "").trim();
  if (!existingPax && (firstName || lastName)) {
    const paxTotal = Math.max(1, Number(quotation?.pax_count ?? 1) || 1);
    const rows = [
      {
        booking_id: bookingId,
        user_id: uid,
        first_name: firstName || "Titular",
        last_name: lastName || "—",
        email: quotation?.guest_email ?? null,
        phone: quotation?.guest_whatsapp ?? null,
        is_lead_passenger: true,
      },
      ...Array.from({ length: paxTotal - 1 }, (_, i) => ({
        booking_id: bookingId,
        user_id: uid,
        first_name: `Acompañante ${i + 2}`,
        last_name: "—",
        is_lead_passenger: false,
        relationship_to_lead_passenger: "Acompañante",
        notes: "Datos pendientes de completar (generado desde la cotización).",
      })),
    ];
    const { error } = await supabase.from("booking_passengers").insert(rows as never);
    if (error) throw error;
  }
}


/**
 * Traduce el bloqueo de organización propietaria (trigger
 * `bookings_require_organization`) a un mensaje comprensible.
 */
export function bookingCreateErrorMessage(error: { message?: string; hint?: string | null }): string {
  const msg = error.message ?? "No se pudo crear la reserva";
  if (!msg.includes("Booking requires a valid organization")) return msg;
  switch (error.hint) {
    case "ambiguous_organization":
      return "Pertenecés a más de una organización: indicá explícitamente la organización propietaria de la reserva.";
    case "not_allowed_for_organization":
      return "No tenés permisos para crear reservas en esa organización.";
    default:
      return "La reserva necesita una organización comercial propietaria válida.";
  }
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
