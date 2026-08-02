/**
 * Motor de Itinerarios — Fase 0 (solo tipos y etiquetas).
 *
 * Esta capa NO genera itinerarios, no calcula precios, no consulta
 * disponibilidad y no llama APIs externas. Solo describe el modelo de datos.
 */

export type ItineraryType =
  | "city_break"
  | "circuit"
  | "excursion"
  | "package"
  | "custom";

export type ItineraryServiceKind =
  | "hotel"
  | "transfer"
  | "activity"
  | "car_rental"
  | "insurance"
  | "flight"
  | "meal"
  | "custom";

export type ItineraryRequestSource =
  | "crm"
  | "widget"
  | "api"
  | "manual"
  | "whitelabel";

export type ItineraryRequestStatus =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled";

export const ITINERARY_TYPE_LABELS: Record<ItineraryType, string> = {
  city_break: "City break",
  circuit: "Circuito",
  excursion: "Excursión",
  package: "Paquete",
  custom: "Personalizado",
};

export const ITINERARY_SERVICE_KIND_LABELS: Record<ItineraryServiceKind, string> = {
  hotel: "Alojamiento",
  transfer: "Traslado",
  activity: "Actividad",
  car_rental: "Alquiler de auto",
  insurance: "Seguro",
  flight: "Vuelo",
  meal: "Comida",
  custom: "Personalizado",
};

export const ITINERARY_REQUEST_SOURCE_LABELS: Record<ItineraryRequestSource, string> = {
  crm: "CRM",
  widget: "Widget",
  api: "API",
  manual: "Manual",
  whitelabel: "Marca blanca",
};

export const ITINERARY_REQUEST_STATUS_LABELS: Record<ItineraryRequestStatus, string> = {
  pending: "Pendiente",
  processing: "En proceso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export interface ItineraryTemplate {
  id: string;
  owner_id: string;
  organization_id: string | null;
  code: string;
  name: string;
  description: string | null;
  destination: string | null;
  itinerary_type: ItineraryType;
  duration_days: number;
  duration_nights: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItineraryTemplateItem {
  id: string;
  template_id: string;
  sequence: number;
  day_number: number;
  service_kind: ItineraryServiceKind;
  title: string | null;
  mandatory: boolean;
  optional: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItineraryRule {
  id: string;
  template_id: string;
  minimum_passengers: number | null;
  maximum_passengers: number | null;
  minimum_nights: number | null;
  maximum_nights: number | null;
  compatible_destinations: string[];
  compatible_seasons: string[];
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItineraryVersion {
  id: string;
  template_id: string;
  version: number;
  published: boolean;
  snapshot: unknown;
  created_by: string | null;
  created_at: string;
}

export interface ItineraryRequestRecord {
  id: string;
  owner_id: string | null;
  organization_id: string | null;
  destination: string | null;
  travel_start: string | null;
  travel_end: string | null;
  adults: number;
  children: number;
  infants: number;
  request_source: ItineraryRequestSource;
  status: ItineraryRequestStatus;
  notes: string | null;
  created_at: string;
}
