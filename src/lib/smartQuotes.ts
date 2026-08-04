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
