/**
 * Orquestador Multiproveedor — v1.10.3 Fase A (solo tipos y catálogos)
 *
 * Capa de búsqueda que consulta inventario, disponibilidad y tarifas para
 * generar opciones combinadas. NO reserva, NO cobra, NO bloquea cupos.
 */

export const SEARCH_REQUEST_TYPES = [
  "package",
  "accommodation",
  "activity",
  "transfer",
  "rental",
  "custom",
] as const;
export type SearchRequestType = (typeof SEARCH_REQUEST_TYPES)[number];

export const SEARCH_REQUEST_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "expired",
] as const;
export type SearchRequestStatus = (typeof SEARCH_REQUEST_STATUSES)[number];

export const SEARCH_SERVICE_CATEGORIES = [
  "accommodation",
  "activity",
  "transfer",
  "rental",
  "package",
] as const;
export type SearchServiceCategory = (typeof SEARCH_SERVICE_CATEGORIES)[number];

export const SEARCH_AVAILABILITY_STATUSES = [
  "available",
  "unavailable",
  "request_only",
  "unknown",
] as const;
export type SearchAvailabilityStatus =
  (typeof SEARCH_AVAILABILITY_STATUSES)[number];

export const SEARCH_PRICING_STATUSES = [
  "calculated",
  "unavailable",
  "pending",
] as const;
export type SearchPricingStatus = (typeof SEARCH_PRICING_STATUSES)[number];

export const SEARCH_SOURCE_TYPES = ["internal", "api", "manual"] as const;
export type SearchSourceType = (typeof SEARCH_SOURCE_TYPES)[number];

export const SEARCH_COMPONENT_TYPES = [
  "product",
  "transfer",
  "accommodation",
  "activity",
  "rental",
] as const;
export type SearchComponentType = (typeof SEARCH_COMPONENT_TYPES)[number];

export const SEARCH_REQUEST_TYPE_LABELS: Record<SearchRequestType, string> = {
  package: "Paquete",
  accommodation: "Alojamiento",
  activity: "Actividad",
  transfer: "Traslado",
  rental: "Alquiler",
  custom: "Personalizado",
};

export const SEARCH_REQUEST_STATUS_LABELS: Record<SearchRequestStatus, string> =
  {
    pending: "Pendiente",
    processing: "Procesando",
    completed: "Completada",
    failed: "Fallida",
    expired: "Expirada",
  };

export const SEARCH_SERVICE_CATEGORY_LABELS: Record<
  SearchServiceCategory,
  string
> = {
  accommodation: "Alojamiento",
  activity: "Actividad",
  transfer: "Traslado",
  rental: "Alquiler",
  package: "Paquete",
};

export const SEARCH_AVAILABILITY_STATUS_LABELS: Record<
  SearchAvailabilityStatus,
  string
> = {
  available: "Disponible",
  unavailable: "Sin disponibilidad",
  request_only: "A pedido",
  unknown: "Sin verificar",
};

export const SEARCH_PRICING_STATUS_LABELS: Record<SearchPricingStatus, string> =
  {
    calculated: "Calculado",
    unavailable: "No calculable",
    pending: "Pendiente",
  };

export const SEARCH_SOURCE_TYPE_LABELS: Record<SearchSourceType, string> = {
  internal: "Inventario propio",
  api: "Integración externa",
  manual: "Carga manual",
};

export const SEARCH_COMPONENT_TYPE_LABELS: Record<SearchComponentType, string> =
  {
    product: "Producto",
    transfer: "Traslado",
    accommodation: "Alojamiento",
    activity: "Actividad",
    rental: "Alquiler",
  };

/** Orden de consulta obligatorio del orquestador (Fase A: documental). */
export const ORCHESTRATION_ORDER = [
  "inventory_own",
  "availability_own",
  "pricing_own",
  "external_api",
  "manual_request",
] as const;
export type OrchestrationStep = (typeof ORCHESTRATION_ORDER)[number];

export const ORCHESTRATION_ORDER_LABELS: Record<OrchestrationStep, string> = {
  inventory_own: "1. Inventario propio",
  availability_own: "2. Disponibilidad propia",
  pricing_own: "3. Tarifas propias",
  external_api: "4. Integraciones externas (futuro)",
  manual_request: "5. Solicitud manual",
};

export interface SearchRequest {
  id: string;
  user_id: string;
  organization_id: string | null;
  agent_id: string | null;
  request_type: SearchRequestType;
  destination_country: string | null;
  destination_state: string | null;
  destination_city: string | null;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  infants: number;
  passengers_metadata: Record<string, unknown>;
  status: SearchRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface SearchItem {
  id: string;
  search_request_id: string;
  service_category: SearchServiceCategory;
  quantity: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SearchResult {
  id: string;
  search_request_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  provider_id: string | null;
  organization_id: string | null;
  availability_status: SearchAvailabilityStatus;
  pricing_status: SearchPricingStatus;
  estimated_amount: number | null;
  currency: string | null;
  source_type: SearchSourceType;
  priority: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SearchResultComponent {
  id: string;
  search_result_id: string;
  component_type: SearchComponentType;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  amount: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProviderSearchSource {
  id: string;
  user_id: string;
  organization_id: string | null;
  provider_id: string | null;
  source_type: SearchSourceType;
  priority: number;
  active: boolean;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
