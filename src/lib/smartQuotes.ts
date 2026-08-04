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
  currency: string;
  total_amount: number | null;
  snapshot: Record<string, unknown>;
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
  return data.id as string;
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
      organization_id: sq.organization_id ?? null,
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

export type SmartQuoteItemInput = {
  title: string;
  description?: string | null;
  item_type: SmartQuoteItemType;
  quantity: number;
  unit_amount: number;
  currency: string;
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

/**
 * Recalcula el total de la Smart Quote como suma simple de sus ítems.
 * No es motor tarifario: sólo consolida la carga manual del agente.
 */
export async function recalcSmartQuoteTotal(smartQuoteId: string): Promise<number> {
  const items = await listSmartQuoteItems(smartQuoteId);
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
      currency: input.currency,
    })
    .select("id")
    .single();
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  await recalcSmartQuoteTotal(smartQuoteId);
  return data.id as string;
}

export async function deleteSmartQuoteItem(
  smartQuoteId: string,
  itemId: string,
): Promise<void> {
  const { error } = await supabase.from("smart_quote_items").delete().eq("id", itemId);
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  await recalcSmartQuoteTotal(smartQuoteId);
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
      total_amount: total,
      currency: sq.currency,
    })
    .select("id")
    .single();
  if (error) throw new Error(smartQuoteCreateErrorMessage(error));
  return data.id as string;
}

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
