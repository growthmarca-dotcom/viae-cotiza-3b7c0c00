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
    _opportunity_id: params.opportunityId ?? null,
    _client_id: params.clientId ?? null,
    _agent_id: params.agentId ?? null,
    _explicit_org_id: params.explicitOrganizationId ?? null,
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
      passengers_metadata: input.passengers_metadata ?? {},
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
