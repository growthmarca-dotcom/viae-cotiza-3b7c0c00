/**
 * Motor de Cotización Inteligente — v1.10.6 Fase A
 *
 * Solo tipos y catálogos de apoyo. En esta fase NO hay cálculo tarifario,
 * validación de disponibilidad, reservas ni bloqueo de inventario.
 *
 * Una cotización inteligente (smart_quote) es una composición de productos,
 * variantes, tarifas y disponibilidad consultadas, con trazabilidad completa
 * del cálculo realizado (snapshots inmutables).
 */

import { supabase } from "@/integrations/supabase/client";

export type SmartQuoteSource = "manual" | "orchestrator" | "package" | "external";

export type SmartQuoteStatus =
  | "draft"
  | "calculating"
  | "ready"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

export type SmartQuoteItemType =
  | "accommodation"
  | "activity"
  | "excursion"
  | "transfer"
  | "rental"
  | "package"
  | "other";

export type SmartQuoteSourceType = "internal" | "provider" | "api" | "manual";

export type SmartQuoteVersionStatus = "draft" | "published" | "retired";

export const SMART_QUOTE_SOURCE_LABELS: Record<SmartQuoteSource, string> = {
  manual: "Manual",
  orchestrator: "Orquestador",
  package: "Paquete",
  external: "Externa",
};

export const SMART_QUOTE_STATUS_LABELS: Record<SmartQuoteStatus, string> = {
  draft: "Borrador",
  calculating: "Calculando",
  ready: "Lista",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};

export const SMART_QUOTE_ITEM_TYPE_LABELS: Record<SmartQuoteItemType, string> = {
  accommodation: "Alojamiento",
  activity: "Actividad",
  excursion: "Excursión",
  transfer: "Traslado",
  rental: "Alquiler",
  package: "Paquete",
  other: "Otro",
};

export const SMART_QUOTE_SOURCE_TYPE_LABELS: Record<SmartQuoteSourceType, string> = {
  internal: "Inventario propio",
  provider: "Proveedor",
  api: "Integración API",
  manual: "Carga manual",
};

export const SMART_QUOTE_VERSION_STATUS_LABELS: Record<SmartQuoteVersionStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  retired: "Retirada",
};

/**
 * Ciclo de vida comercial permitido de una cotización inteligente.
 * Referencia de diseño; la validación se implementará en fases posteriores.
 */
export const SMART_QUOTE_STATUS_FLOW: Record<SmartQuoteStatus, SmartQuoteStatus[]> = {
  draft: ["calculating", "expired"],
  calculating: ["ready", "draft"],
  ready: ["sent", "draft", "expired"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: ["draft"],
};

/**
 * Orden obligatorio de resolución antes de persistir una cotización inteligente.
 * Coincide con ORCHESTRATION_ORDER del Orquestador Multiproveedor.
 */
export const SMART_QUOTE_RESOLUTION_ORDER = [
  "inventory",
  "availability",
  "pricing",
  "external_api",
  "manual_request",
] as const;

export type SmartQuoteResolutionStep = (typeof SMART_QUOTE_RESOLUTION_ORDER)[number];

export interface SmartQuote {
  id: string;
  user_id: string;
  organization_id: string | null;
  /** v1.10.9.1 — oportunidad origen del flujo Opportunity → Smart Quote → Quotation → Booking. */
  opportunity_id: string | null;
  agent_id: string | null;
  client_id: string | null;
  source: SmartQuoteSource;
  status: SmartQuoteStatus;
  title: string;
  destination_country: string | null;
  destination_state: string | null;
  destination_city: string | null;
  start_date: string | null;
  end_date: string | null;
  passengers_metadata: Record<string, unknown>;
  /** v1.12.3 — notas internas del agente (no se publican al cliente). */
  notes: string | null;
  currency: string;
  total_amount: number | null;
  snapshot: Record<string, unknown>;
  /** v1.13 — enlace público de la propuesta (Fase 3.0). */
  share_token: string | null;
  shared_at: string | null;
  share_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmartQuoteItem {
  id: string;
  smart_quote_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  package_id: string | null;
  item_type: SmartQuoteItemType;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  currency: string;
  pricing_snapshot: Record<string, unknown>;
  availability_snapshot: Record<string, unknown>;
  created_at: string;
}

export interface SmartQuotePricing {
  id: string;
  smart_quote_item_id: string;
  pricing_profile_id: string | null;
  pricing_rule_id: string | null;
  passenger_type: string | null;
  quantity: number;
  base_amount: number;
  calculated_amount: number;
  currency: string;
  calculation_metadata: Record<string, unknown>;
  created_at: string;
}

export interface SmartQuoteVersion {
  id: string;
  smart_quote_id: string;
  version: number;
  status: SmartQuoteVersionStatus;
  snapshot: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface SmartQuoteSourceRecord {
  id: string;
  smart_quote_id: string;
  source_type: SmartQuoteSourceType;
  provider_id: string | null;
  organization_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/* =========================================================================
 * v1.10.9.1 — Smart Quote Integration Foundation (Fase B1)
 *
 * Flujo comercial: Opportunity → Smart Quote → Quotation → Booking.
 * `smart_quotes` es el motor comercial/cálculo, `quotations` la capa de
 * presentación al cliente (PDF, enlace público, aceptación) y `bookings` la
 * capa operativa. Estos helpers sólo propagan contexto; no calculan precios.
 * ========================================================================= */

export interface SmartQuoteOrganizationResolution {
  organization_id: string | null;
  source: string;
  confidence: string;
  error: string | null;
  candidates?: string[] | null;
}

/**
 * Resuelve la organización propietaria de una Smart Quote con el mismo orden
 * de precedencia que la base de datos: explícita > oportunidad > agente >
 * cliente > membresía única del creador. Si hay varias candidatas devuelve
 * `error: "ambiguous_organization"`; nunca inventa una organización.
 */
export async function resolveSmartQuoteOrganization(params: {
  creatorUserId: string;
  opportunityId?: string | null;
  clientId?: string | null;
  agentId?: string | null;
  explicitOrganizationId?: string | null;
}): Promise<SmartQuoteOrganizationResolution> {
  const { data, error } = await supabase.rpc("resolve_smart_quote_organization", {
    _creator_user_id: params.creatorUserId,
    _opportunity_id: params.opportunityId ?? undefined,
    _client_id: params.clientId ?? undefined,
    _agent_id: params.agentId ?? undefined,
    _explicit_org_id: params.explicitOrganizationId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as SmartQuoteOrganizationResolution;
}

export function smartQuoteCreateErrorMessage(error: { message?: string; hint?: string | null }) {
  const hint = error.hint ?? "";
  const message = error.message ?? "";
  if (hint.includes("ambiguous_organization") || message.includes("ambiguous_organization")) {
    return "Pertenecés a más de una organización posible. Elegí explícitamente la organización de la cotización.";
  }
  if (hint.includes("no_organization_found") || message.includes("requires an organization")) {
    return "No se pudo determinar la organización de la cotización inteligente.";
  }
  if (hint.includes("organization_mismatch")) {
    return "La cotización inteligente y el registro vinculado pertenecen a organizaciones distintas.";
  }
  if (hint.includes("opportunity_mismatch")) {
    return "La cotización y la cotización inteligente apuntan a oportunidades distintas.";
  }
  if (hint.includes("currency_mismatch") || message.includes("must match")) {
    return "La moneda del ítem debe coincidir con la moneda de la cotización inteligente.";
  }
  if (hint.includes("smart_quote_currency_missing")) {
    return "La cotización inteligente necesita una moneda definida.";
  }
  if (hint.includes("invalid_quantity")) return "La cantidad debe ser mayor a cero.";
  if (hint.includes("invalid_unit_amount")) return "El precio unitario debe ser cero o mayor.";
  if (hint.includes("structural_field_locked")) {
    return "No podés cambiar la organización, oportunidad, cliente ni agente de esta cotización inteligente.";
  }
  return message || "No se pudo guardar la cotización inteligente.";
}

export type SmartQuoteDraftInput = {
  title: string;
  source?: SmartQuoteSource;
  currency?: string;
  destination_country?: string | null;
  destination_state?: string | null;
  destination_city?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  passengers_metadata?: Record<string, unknown>;
  /** Organización explícita; requerida cuando la resolución es ambigua. */
  organization_id?: string | null;
  client_id?: string | null;
  agent_id?: string | null;
};

/**
 * Crea una Smart Quote heredando el contexto comercial de la oportunidad:
 * organization_id, opportunity_id, client_id y agent_id.
 */
export async function createSmartQuoteFromOpportunity(
  opportunityId: string,
  input: SmartQuoteDraftInput,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");

  const { data: opp, error: oppErr } = await supabase
    .from("opportunities")
    .select("organization_id, client_id, assigned_agent_id")
    .eq("id", opportunityId)
    .maybeSingle();
  if (oppErr) throw oppErr;
  if (!opp) throw new Error("La oportunidad no existe o no es accesible.");

  const { data, error } = await supabase
    .from("smart_quotes")
    .insert({
      user_id: uid,
      opportunity_id: opportunityId,
      organization_id: input.organization_id ?? opp.organization_id ?? null,
      client_id: input.client_id ?? opp.client_id ?? null,
      agent_id: input.agent_id ?? opp.assigned_agent_id ?? null,
      title: input.title,
      source: input.source ?? "manual",
      status: "draft",
      currency: input.currency ?? "USD",
      destination_country: input.destination_country ?? null,
      destination_state: input.destination_state ?? null,
      destination_city: input.destination_city ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      passengers_metadata: (input.passengers_metadata ?? {}) as never,
    })
    .select("id")
    .single();
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  const newId = data.id as string;
  await recordSmartQuoteVersion(newId, "created");
  return newId;
}

/**
 * Vincula una cotización de presentación existente a su Smart Quote origen,
 * conservando smart_quote_id, opportunity_id y organization_id. La coherencia
 * multi-tenant la valida la base (trg_quotation_smart_quote_same_org).
 */
export async function linkQuotationToSmartQuote(
  quotationId: string,
  smartQuoteId: string,
): Promise<void> {
  const { data: sq, error: sqErr } = await supabase
    .from("smart_quotes")
    .select("organization_id, opportunity_id")
    .eq("id", smartQuoteId)
    .maybeSingle();
  if (sqErr) throw sqErr;
  if (!sq) throw new Error("La cotización inteligente no existe o no es accesible.");

  const { error } = await supabase
    .from("quotations")
    .update({
      smart_quote_id: smartQuoteId,
      opportunity_id: sq.opportunity_id ?? null,
      ...(sq.organization_id ? { organization_id: sq.organization_id } : {}),
    })
    .eq("id", quotationId);
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
}

/* =========================================================================
 * v1.10.9.2 — Smart Quote MVP Comercial (Fase B4 parcial)
 *
 * Listado, detalle, constructor manual de ítems, ciclo de vida controlado y
 * generación de la cotización de presentación (`quotations`) desde la Smart
 * Quote. Sin motor de cálculo, disponibilidad, tarifas ni orquestador.
 * ========================================================================= */

export type SmartQuoteListRow = SmartQuote & {
  clients: { id: string; full_name: string | null; last_name: string | null } | null;
  opportunities: { id: string; title: string } | null;
  agents: { id: string; first_name: string | null; last_name: string | null } | null;
};

export type SmartQuoteFilters = {
  status?: SmartQuoteStatus | "all";
  agentId?: string | "all";
  search?: string;
};

const LIST_SELECT =
  "*, clients(id, full_name, last_name), opportunities(id, title), agents(id, first_name, last_name)";

export function smartQuoteClientLabel(row: Pick<SmartQuoteListRow, "clients">): string {
  const c = row.clients;
  if (!c) return "Sin cliente";
  return [c.full_name, c.last_name].filter(Boolean).join(" ").trim() || "Cliente";
}

export function smartQuoteAgentLabel(row: Pick<SmartQuoteListRow, "agents">): string {
  const a = row.agents;
  if (!a) return "Sin agente";
  return [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || "Agente";
}

export function smartQuoteStatusClasses(status: string | null): string {
  switch (status) {
    case "accepted":
      return "bg-primary/10 text-primary border-primary/30";
    case "sent":
    case "ready":
      return "bg-gold/15 text-foreground border-gold/40";
    case "rejected":
    case "expired":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Listado de Smart Quotes visibles para el usuario (RLS decide el alcance). */
export async function listSmartQuotes(
  filters: SmartQuoteFilters = {},
): Promise<SmartQuoteListRow[]> {
  let q = supabase.from("smart_quotes").select(LIST_SELECT).order("created_at", {
    ascending: false,
  });
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.agentId && filters.agentId !== "all") q = q.eq("agent_id", filters.agentId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as SmartQuoteListRow[];
  const term = filters.search?.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) =>
    [r.title, smartQuoteClientLabel(r), r.destination_city, r.destination_country]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term)),
  );
}

export async function getSmartQuote(id: string): Promise<SmartQuoteListRow | null> {
  const { data, error } = await supabase
    .from("smart_quotes")
    .select(LIST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SmartQuoteListRow) ?? null;
}

/** Smart Quotes de una oportunidad (vínculo del Pipeline Comercial). */
export async function listSmartQuotesByOpportunity(
  opportunityId: string,
): Promise<SmartQuote[]> {
  const { data, error } = await supabase
    .from("smart_quotes")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SmartQuote[];
}

// -------------------------------------------------------- constructor manual

export type SmartQuoteItemRow = SmartQuoteItem & {
  title: string;
  description: string | null;
};

/**
 * v1.12.2 (Fase 2.1) — Arquitectura de moneda única.
 * El ítem NO define moneda: siempre hereda `smart_quotes.currency`.
 */
export type SmartQuoteItemInput = {
  title: string;
  description?: string | null;
  item_type: SmartQuoteItemType;
  quantity: number;
  unit_amount: number;
};

export async function listSmartQuoteItems(smartQuoteId: string): Promise<SmartQuoteItemRow[]> {
  const { data, error } = await supabase
    .from("smart_quote_items")
    .select("*")
    .eq("smart_quote_id", smartQuoteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SmartQuoteItemRow[];
}

/** Moneda de la cabecera: única fuente de verdad de la cotización. */
export async function getSmartQuoteCurrency(smartQuoteId: string): Promise<string> {
  const { data, error } = await supabase
    .from("smart_quotes")
    .select("currency")
    .eq("id", smartQuoteId)
    .maybeSingle();
  if (error) throw error;
  const currency = (data?.currency ?? "").toUpperCase();
  if (!currency) throw new Error("La cotización inteligente no tiene moneda definida.");
  return currency;
}

/**
 * Recalcula el total de la Smart Quote como suma simple de sus ítems.
 * Al existir moneda única, la suma es aritmética directa (sin conversión).
 * La base recalcula el total con trigger; esta función devuelve el valor
 * consolidado y sirve de red de seguridad para registros antiguos.
 */
export async function recalcSmartQuoteTotal(smartQuoteId: string): Promise<number> {
  const [currency, items] = await Promise.all([
    getSmartQuoteCurrency(smartQuoteId),
    listSmartQuoteItems(smartQuoteId),
  ]);
  const foreign = items.find((i) => (i.currency ?? "").toUpperCase() !== currency);
  if (foreign) {
    throw new Error(
      `La cotización tiene ítems en ${foreign.currency} y su moneda es ${currency}. Corregí la moneda antes de recalcular.`,
    );
  }
  const total = items.reduce((acc, i) => acc + Number(i.total_amount ?? 0), 0);
  const { error } = await supabase
    .from("smart_quotes")
    .update({ total_amount: total })
    .eq("id", smartQuoteId);
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  return total;
}

export async function addSmartQuoteItem(
  smartQuoteId: string,
  input: SmartQuoteItemInput,
): Promise<string> {
  const quantity = Number(input.quantity) || 0;
  const unit = Number(input.unit_amount) || 0;
  if (!input.title.trim()) throw new Error("El ítem necesita un nombre.");
  if (quantity <= 0) throw new Error("La cantidad debe ser mayor a cero.");
  if (!Number.isFinite(unit) || unit < 0) {
    throw new Error("El precio unitario debe ser cero o mayor.");
  }
  // Moneda única: se lee de la cabecera, nunca se acepta desde el formulario.
  const currency = await getSmartQuoteCurrency(smartQuoteId);
  const { data, error } = await supabase
    .from("smart_quote_items")
    .insert({
      smart_quote_id: smartQuoteId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      item_type: input.item_type,
      quantity,
      unit_amount: unit,
      total_amount: quantity * unit,
      currency,
    })
    .select("id")
    .single();
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  await recalcSmartQuoteTotal(smartQuoteId);
  await recordSmartQuoteVersion(smartQuoteId, "item_added");
  return data.id as string;
}

/* =========================================================================
 * v1.12.3 (Fase 2.2) — Edición comercial de la cabecera
 *
 * La cabecera es editable por admin, operaciones y el agente asignado.
 * Los campos estructurales (organización, oportunidad, cliente, agente) NO se
 * editan acá: los protege `tg_smart_quote_guard_update` en la base.
 * ========================================================================= */

/** Composición de pasajeros guardada en `passengers_metadata`. */
export type SmartQuotePassengers = {
  adults: number;
  children: number;
  infants: number;
};

export const EMPTY_PASSENGERS: SmartQuotePassengers = { adults: 1, children: 0, infants: 0 };

function toCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Lee la composición de pasajeros tolerando registros antiguos o vacíos. */
export function parseSmartQuotePassengers(
  metadata: Record<string, unknown> | null | undefined,
): SmartQuotePassengers {
  if (!metadata || typeof metadata !== "object") return { ...EMPTY_PASSENGERS };
  return {
    adults: toCount((metadata as Record<string, unknown>).adults ?? EMPTY_PASSENGERS.adults),
    children: toCount((metadata as Record<string, unknown>).children),
    infants: toCount((metadata as Record<string, unknown>).infants),
  };
}

export function totalSmartQuotePassengers(p: SmartQuotePassengers): number {
  return p.adults + p.children + p.infants;
}

export function smartQuotePassengersLabel(
  metadata: Record<string, unknown> | null | undefined,
): string {
  const p = parseSmartQuotePassengers(metadata);
  const parts = [`${p.adults} adulto${p.adults === 1 ? "" : "s"}`];
  if (p.children > 0) parts.push(`${p.children} menor${p.children === 1 ? "" : "es"}`);
  if (p.infants > 0) parts.push(`${p.infants} infante${p.infants === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export type SmartQuoteHeaderPatch = {
  title?: string;
  destination_country?: string | null;
  destination_state?: string | null;
  destination_city?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  passengers?: SmartQuotePassengers;
  notes?: string | null;
  /** Moneda existente de la cotización: la base propaga el cambio a los ítems. */
  currency?: string;
};

/**
 * Edición de la cabecera comercial. Valida datos mínimos en el cliente; la
 * base valida el rango de fechas y la coherencia de moneda con los ítems.
 */
export async function updateSmartQuoteHeader(
  smartQuoteId: string,
  patch: SmartQuoteHeaderPatch,
): Promise<void> {
  const payload: {
    title?: string;
    destination_country?: string | null;
    destination_state?: string | null;
    destination_city?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    passengers_metadata?: SmartQuotePassengers;
    notes?: string | null;
    currency?: string;
  } = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new Error("La cotización necesita un título.");
    payload.title = patch.title.trim();
  }
  if (patch.destination_country !== undefined) {
    payload.destination_country = patch.destination_country?.trim() || null;
  }
  if (patch.destination_state !== undefined) {
    payload.destination_state = patch.destination_state?.trim() || null;
  }
  if (patch.destination_city !== undefined) {
    payload.destination_city = patch.destination_city?.trim() || null;
  }
  if (patch.start_date !== undefined) payload.start_date = patch.start_date || null;
  if (patch.end_date !== undefined) payload.end_date = patch.end_date || null;
  const start = (payload.start_date ?? undefined) as string | null | undefined;
  const end = (payload.end_date ?? undefined) as string | null | undefined;
  if (start && end && end < start) {
    throw new Error("La fecha de fin no puede ser anterior a la de inicio.");
  }
  if (patch.passengers !== undefined) {
    const p = {
      adults: toCount(patch.passengers.adults),
      children: toCount(patch.passengers.children),
      infants: toCount(patch.passengers.infants),
    };
    if (p.adults < 1) throw new Error("Tiene que haber al menos un pasajero adulto.");
    payload.passengers_metadata = p;
  }
  if (patch.notes !== undefined) payload.notes = patch.notes?.trim() || null;
  if (patch.currency !== undefined) {
    const next = patch.currency.trim().toUpperCase();
    if (!next) throw new Error("Indicá una moneda válida.");
    payload.currency = next;
  }
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("smart_quotes").update(payload).eq("id", smartQuoteId);
  if (error) {
    if ((error.message ?? "").includes("smart_quotes_date_range_check")) {
      throw new Error("La fecha de fin no puede ser anterior a la de inicio.");
    }
    throw new Error(smartQuoteCreateErrorMessage(error));
  }
  if (payload.currency !== undefined) await recalcSmartQuoteTotal(smartQuoteId);
  const onlyCurrency =
    Object.keys(payload).length === 1 && payload.currency !== undefined;
  await recordSmartQuoteVersion(
    smartQuoteId,
    onlyCurrency ? "currency_changed" : "header_updated",
  );
}

export type SmartQuoteItemPatch = {
  title?: string;
  description?: string | null;
  item_type?: SmartQuoteItemType;
  quantity?: number;
  unit_amount?: number;
};

/** Edición de un ítem. La moneda nunca es editable (moneda única). */
export async function updateSmartQuoteItem(
  smartQuoteId: string,
  itemId: string,
  patch: SmartQuoteItemPatch,
): Promise<void> {
  const payload: {
    title?: string;
    description?: string | null;
    item_type?: SmartQuoteItemType;
    quantity?: number;
    unit_amount?: number;
  } = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new Error("El ítem necesita un nombre.");
    payload.title = patch.title.trim();
  }
  if (patch.description !== undefined) payload.description = patch.description?.trim() || null;
  if (patch.item_type !== undefined) payload.item_type = patch.item_type;
  if (patch.quantity !== undefined) {
    const quantity = Number(patch.quantity) || 0;
    if (quantity <= 0) throw new Error("La cantidad debe ser mayor a cero.");
    payload.quantity = quantity;
  }
  if (patch.unit_amount !== undefined) {
    const unit = Number(patch.unit_amount);
    if (!Number.isFinite(unit) || unit < 0) {
      throw new Error("El precio unitario debe ser cero o mayor.");
    }
    payload.unit_amount = unit;
  }
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase
    .from("smart_quote_items")
    .update(payload)
    .eq("id", itemId)
    .eq("smart_quote_id", smartQuoteId);
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  await recalcSmartQuoteTotal(smartQuoteId);
  await recordSmartQuoteVersion(smartQuoteId, "item_updated");
}

/**
 * Cambia la moneda de la cotización. La base propaga la nueva moneda a los
 * ítems y a sus detalles de precio: no se convierten importes, se redenomina.
 */
export async function updateSmartQuoteCurrency(
  smartQuoteId: string,
  currency: string,
): Promise<void> {
  const next = currency.trim().toUpperCase();
  if (!next) throw new Error("Indicá una moneda válida.");
  const { error } = await supabase
    .from("smart_quotes")
    .update({ currency: next })
    .eq("id", smartQuoteId);
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  await recalcSmartQuoteTotal(smartQuoteId);
  await recordSmartQuoteVersion(smartQuoteId, "currency_changed");
}

export async function deleteSmartQuoteItem(
  smartQuoteId: string,
  itemId: string,
): Promise<void> {
  const { error } = await supabase.from("smart_quote_items").delete().eq("id", itemId);
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  await recalcSmartQuoteTotal(smartQuoteId);
  await recordSmartQuoteVersion(smartQuoteId, "item_removed");
}


/* =========================================================================
 * v1.12.4 (Fase 2.3) — Versionado real del historial comercial
 *
 * Cada cambio con impacto comercial (creación, cabecera, ítems, moneda)
 * guarda una versión en `smart_quote_versions`: snapshot completo, número
 * consecutivo (lo asigna la base), usuario creador, fecha y motivo.
 * El historial es append-only: no se edita, no se borra y todavía NO se
 * restaura. RLS de la tabla: se lee/escribe según permisos de la cotización.
 * ========================================================================= */

export type SmartQuoteSnapshot = {
  version_schema: "v1";
  header: {
    title: string;
    destination_country: string | null;
    destination_state: string | null;
    destination_city: string | null;
    start_date: string | null;
    end_date: string | null;
    passengers: SmartQuotePassengers;
    notes: string | null;
    currency: string;
    total_amount: number;
  };
  items: {
    title: string;
    description: string | null;
    item_type: SmartQuoteItemType;
    quantity: number;
    unit_amount: number;
    total_amount: number;
  }[];
};

/** Construye el snapshot de la cotización. Sólo memoria: no persiste nada. */
export function buildSmartQuoteSnapshot(
  quote: SmartQuote,
  items: SmartQuoteItemRow[],
): SmartQuoteSnapshot {
  return {
    version_schema: "v1",
    header: {
      title: quote.title,
      destination_country: quote.destination_country,
      destination_state: quote.destination_state,
      destination_city: quote.destination_city,
      start_date: quote.start_date,
      end_date: quote.end_date,
      passengers: parseSmartQuotePassengers(quote.passengers_metadata),
      notes: quote.notes ?? null,
      currency: quote.currency,
      total_amount: Number(quote.total_amount ?? 0),
    },
    items: items.map((i) => ({
      title: i.title,
      description: i.description,
      item_type: i.item_type,
      quantity: Number(i.quantity),
      unit_amount: Number(i.unit_amount ?? 0),
      total_amount: Number(i.total_amount ?? 0),
    })),
  };
}

/** Motivos internos de una versión (trazabilidad comercial). */
export const SMART_QUOTE_VERSION_REASONS = {
  created: "Creación de la cotización",
  header_updated: "Edición de la cabecera comercial",
  item_added: "Alta de ítem",
  item_updated: "Edición de ítem",
  item_removed: "Baja de ítem",
  currency_changed: "Cambio de moneda",
} as const;

export type SmartQuoteVersionReason = keyof typeof SMART_QUOTE_VERSION_REASONS;

export type SmartQuoteVersionRow = SmartQuoteVersion & {
  reason: string | null;
  total_amount: number;
  currency: string | null;
  /** Nombre del autor cuando el perfil es legible; si no, null. */
  created_by_name?: string | null;
};

/**
 * Guarda una versión con el estado actual completo de la cotización.
 * El número de versión lo asigna la base (consecutivo por cotización) y
 * `created_by` toma por defecto el usuario autenticado.
 */
export async function createSmartQuoteVersion(
  smartQuoteId: string,
  reason: SmartQuoteVersionReason | string,
): Promise<SmartQuoteVersionRow> {
  const [{ data: quote, error: quoteErr }, items] = await Promise.all([
    supabase.from("smart_quotes").select("*").eq("id", smartQuoteId).maybeSingle(),
    listSmartQuoteItems(smartQuoteId),
  ]);
  if (quoteErr) throw quoteErr;
  if (!quote) throw new Error("La cotización inteligente no existe o no es accesible.");

  const sq = quote as unknown as SmartQuote;
  const snapshot = buildSmartQuoteSnapshot(sq, items);
  const label =
    (SMART_QUOTE_VERSION_REASONS as Record<string, string>)[reason] ?? String(reason);

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("smart_quote_versions")
    .insert({
      smart_quote_id: smartQuoteId,
      status: "draft",
      snapshot: snapshot as never,
      reason: label,
      total_amount: snapshot.header.total_amount,
      currency: snapshot.header.currency,
      created_by: userData.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  return data as unknown as SmartQuoteVersionRow;
}

/**
 * Alta de versión "best effort": nunca hace fallar la operación comercial
 * que la originó (el dato de negocio ya quedó guardado).
 */
export async function recordSmartQuoteVersion(
  smartQuoteId: string,
  reason: SmartQuoteVersionReason,
): Promise<void> {
  try {
    await createSmartQuoteVersion(smartQuoteId, reason);
  } catch (err) {
    console.warn("No se pudo registrar la versión de la cotización inteligente", err);
  }
}

/** Histórico de versiones, de la más reciente a la más antigua. */
export async function listSmartQuoteVersions(
  smartQuoteId: string,
): Promise<SmartQuoteVersionRow[]> {
  const { data, error } = await supabase
    .from("smart_quote_versions")
    .select("*")
    .eq("smart_quote_id", smartQuoteId)
    .order("version", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as SmartQuoteVersionRow[];
  const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  if (ids.length === 0) return rows;
  // `profiles` es legible según RLS (admin o el propio usuario): si no hay
  // acceso, se muestra el autor como desconocido sin romper el historial.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({
    ...r,
    created_by_name: r.created_by ? (names.get(r.created_by) ?? null) : null,
  }));
}

/** Detalle de una versión puntual (snapshot completo). */
export async function getSmartQuoteVersion(
  versionId: string,
): Promise<SmartQuoteVersionRow | null> {
  const { data, error } = await supabase
    .from("smart_quote_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SmartQuoteVersionRow) ?? null;
}

/** Lee el snapshot tipado de una versión (tolerante con formatos antiguos). */
export function parseSmartQuoteVersionSnapshot(
  version: SmartQuoteVersionRow,
): SmartQuoteSnapshot | null {
  const snap = version.snapshot as unknown;
  if (!snap || typeof snap !== "object") return null;
  const candidate = snap as Partial<SmartQuoteSnapshot>;
  if (!candidate.header || !Array.isArray(candidate.items)) return null;
  return candidate as SmartQuoteSnapshot;
}



// -------------------------------------------------------------- ciclo de vida

/**
 * Cambio de estado controlado: sólo transiciones permitidas por
 * SMART_QUOTE_STATUS_FLOW. La UI nunca escribe `status` directamente.
 */
export async function updateSmartQuoteStatus(
  smartQuoteId: string,
  next: SmartQuoteStatus,
): Promise<void> {
  const { data: current, error: readErr } = await supabase
    .from("smart_quotes")
    .select("status")
    .eq("id", smartQuoteId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!current) throw new Error("La cotización inteligente no existe o no es accesible.");
  const from = current.status as SmartQuoteStatus;
  if (from === next) return;
  if (!SMART_QUOTE_STATUS_FLOW[from]?.includes(next)) {
    throw new Error(
      `Transición no permitida: ${SMART_QUOTE_STATUS_LABELS[from]} → ${SMART_QUOTE_STATUS_LABELS[next]}.`,
    );
  }
  const { error } = await supabase
    .from("smart_quotes")
    .update({ status: next })
    .eq("id", smartQuoteId);
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
}

/** Estados a los que se puede pasar desde el estado actual. */
export function allowedSmartQuoteTransitions(status: SmartQuoteStatus): SmartQuoteStatus[] {
  return SMART_QUOTE_STATUS_FLOW[status] ?? [];
}

// ------------------------------------------------- generar propuesta (quotation)

/**
 * Genera la cotización de presentación (capa cliente: PDF + enlace público)
 * a partir de la Smart Quote, conservando organization_id, opportunity_id,
 * client_id y agent_id. Reutiliza `quotations` tal como está: no duplica
 * lógica de PDF ni de enlace público.
 */
export async function createQuotationFromSmartQuote(smartQuoteId: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");

  const sq = await getSmartQuote(smartQuoteId);
  if (!sq) throw new Error("La cotización inteligente no existe o no es accesible.");
  if (!sq.organization_id) {
    throw new Error(
      "La cotización inteligente no tiene organización propietaria: no se puede generar la propuesta.",
    );
  }

  const items = await listSmartQuoteItems(smartQuoteId);
  const total =
    Number(sq.total_amount ?? 0) ||
    items.reduce((acc, i) => acc + Number(i.total_amount ?? 0), 0);

  const client = sq.clients;
  const firstName = (client?.full_name ?? "").replace(client?.last_name ?? "", "").trim();
  const destination =
    [sq.destination_city, sq.destination_state, sq.destination_country]
      .filter(Boolean)
      .join(", ") || null;
  // Pasajeros y noches viajan a la cotización (los muestra el enlace público).
  const pax = parseSmartQuotePassengers(sq.passengers_metadata as Record<string, unknown>);
  const paxCount = pax.adults + pax.children + pax.infants;
  const nights =
    sq.start_date && sq.end_date
      ? Math.max(
          0,
          Math.round(
            (new Date(`${sq.end_date}T00:00:00`).getTime() -
              new Date(`${sq.start_date}T00:00:00`).getTime()) /
              86400000,
          ),
        ) || null
      : null;

  const description = items
    .map((i) => {
      const detail = i.description ? ` — ${i.description}` : "";
      return `• ${i.title} (x${Number(i.quantity)})${detail}`;
    })
    .join("\n");

  const { data, error } = await supabase
    .from("quotations")
    .insert({
      user_id: uid,
      smart_quote_id: sq.id,
      opportunity_id: sq.opportunity_id,
      organization_id: sq.organization_id,
      client_id: sq.client_id,
      title: sq.title,
      status: "draft",
      destination,
      travel_start: sq.start_date,
      travel_end: sq.end_date,
      guest_first_name: firstName || client?.full_name || null,
      guest_last_name: client?.last_name ?? null,
      accommodation_name: sq.title,
      accommodation_description: description || null,
      pax_count: paxCount || null,
      nights: nights,
      total_amount: total,
      currency: sq.currency,
    })
    .select("id")
    .single();
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  const quotationId = data.id as string;

  // Las líneas de la Smart Quote se trasladan como servicios reales de la
  // cotización (`quotation_items`), no sólo como texto descriptivo.
  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from("quotation_items").insert(
      items.map((i, idx) => ({
        quotation_id: quotationId,
        category: SMART_ITEM_TO_QUOTATION_CATEGORY[i.item_type] ?? "other",
        title: i.title || "Servicio",
        description: i.description ?? null,
        quantity: Number(i.quantity ?? 1),
        unit_amount: Number(i.unit_amount ?? 0),
        taxes: 0,
        position: idx,
      })),
    );
    if (itemsErr) throw itemsErr;
  }
  return quotationId;
}

type QuotationItemCategoryValue =
  | "accommodation"
  | "excursion"
  | "vehicle_rental"
  | "transfer"
  | "insurance"
  | "flight"
  | "other";

/** Mapeo de tipo de ítem de Smart Quote a categoría de `quotation_items`. */
const SMART_ITEM_TO_QUOTATION_CATEGORY: Record<string, QuotationItemCategoryValue> = {
  accommodation: "accommodation",
  activity: "excursion",
  excursion: "excursion",
  transfer: "transfer",
  rental: "vehicle_rental",
  package: "other",
  other: "other",
};

/** Cotizaciones de presentación generadas desde una Smart Quote. */
export async function listQuotationsBySmartQuote(smartQuoteId: string) {
  const { data, error } = await supabase
    .from("quotations")
    .select("id, title, status, total_amount, currency, created_at, share_token")
    .eq("smart_quote_id", smartQuoteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* =========================================================================
 * v1.13 Fase 3.0 — Enlace público de la Smart Quote
 *
 * El token se genera en la base (`smart_quote_share_token`) y sólo puede
 * crearlo/revocarlo quien puede gestionar la cotización. La lectura pública
 * pasa por la server function `getPublicSmartQuote`: no hay política `anon`.
 * ========================================================================= */

/** Crea o renueva el enlace público y devuelve el token. */
export async function shareSmartQuote(
  smartQuoteId: string,
  days = 30,
): Promise<string> {
  const { data, error } = await supabase.rpc("smart_quote_share_token", {
    _smart_quote_id: smartQuoteId,
    _days: days,
  });
  if (error) {
    if ((error.message ?? "").includes("not_authorized")) {
      throw new Error("No tenés permisos para compartir esta cotización.");
    }
    throw error;
  }
  return data as unknown as string;
}

/** Revoca el enlace público (el cliente deja de poder abrirlo). */
export async function revokeSmartQuoteShare(smartQuoteId: string): Promise<void> {
  const { error } = await supabase.rpc("smart_quote_share_revoke", {
    _smart_quote_id: smartQuoteId,
  });
  if (error) {
    if ((error.message ?? "").includes("not_authorized")) {
      throw new Error("No tenés permisos para revocar este enlace.");
    }
    throw error;
  }
}

/** URL absoluta de la propuesta pública. */
export function smartQuotePublicUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/propuesta/${token}`;
}
