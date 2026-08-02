/**
 * Motor de Disponibilidad Multiproveedor — Fase 0 (solo tipos y etiquetas).
 *
 * Esta capa NO ejecuta búsquedas, no consulta APIs externas y no calcula cupos.
 * Únicamente describe el modelo de datos creado en la base para que futuras
 * fases (motor de resolución, caché real, conectores) tengan una base tipada.
 */

export type AvailabilitySourceType = "manual" | "api" | "cache" | "external";
export type AvailabilityStatus =
  | "available"
  | "limited"
  | "full"
  | "closed"
  | "blocked";
export type AvailabilityRequestType = "manual" | "api" | "cache" | "fallback";
export type AvailabilityRequestStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export const AVAILABILITY_SOURCE_TYPE_LABELS: Record<AvailabilitySourceType, string> = {
  manual: "Manual",
  api: "API",
  cache: "Caché",
  external: "Externo",
};

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: "Disponible",
  limited: "Limitado",
  full: "Completo",
  closed: "Cerrado",
  blocked: "Bloqueado",
};

export const AVAILABILITY_REQUEST_TYPE_LABELS: Record<AvailabilityRequestType, string> = {
  manual: "Manual",
  api: "API",
  cache: "Caché",
  fallback: "Respaldo",
};

export const AVAILABILITY_REQUEST_STATUS_LABELS: Record<AvailabilityRequestStatus, string> = {
  pending: "Pendiente",
  processing: "En proceso",
  completed: "Completada",
  failed: "Fallida",
};

/** Orden de búsqueda sugerido por defecto (solo referencia, no se ejecuta). */
export const DEFAULT_PRIORITY_ORDER: AvailabilitySourceType[] = [
  "api",
  "cache",
  "manual",
];

export interface AvailabilitySource {
  id: string;
  owner_id: string;
  organization_id: string | null;
  provider_id: string | null;
  source_type: AvailabilitySourceType;
  source_name: string;
  priority: number;
  enabled: boolean;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ServiceAvailability {
  id: string;
  owner_id: string;
  organization_id: string | null;
  service_id: string;
  availability_date: string;
  start_time: string | null;
  end_time: string | null;
  available_units: number;
  reserved_units: number;
  status: AvailabilityStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityCacheEntry {
  id: string;
  source_id: string | null;
  service_id: string | null;
  query_hash: string;
  availability_result: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
}

export interface AvailabilityRequestRecord {
  id: string;
  owner_id: string | null;
  service_id: string | null;
  source_id: string | null;
  request_type: AvailabilityRequestType;
  status: AvailabilityRequestStatus;
  response_time: number | null;
  error_message: string | null;
  created_at: string;
}

export interface AvailabilityPolicy {
  id: string;
  owner_id: string;
  organization_id: string | null;
  service_kind: string | null;
  policy_name: string;
  priority_order: unknown;
  fallback_manual: boolean;
  cache_minutes: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
