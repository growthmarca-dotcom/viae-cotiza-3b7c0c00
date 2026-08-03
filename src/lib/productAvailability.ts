/**
 * Conexión Inventario Global + Motor de Disponibilidad — v1.10.2 Fase A
 * (solo tipos y etiquetas).
 *
 * Declara CÓMO se administra la disponibilidad de un producto del catálogo
 * (calendario propio, a pedido o fuente externa) y las reglas del calendario.
 *
 * NO reserva, NO bloquea cupos, NO confirma y NO sincroniza con APIs externas.
 */

export type ProductAvailabilityMode = "calendar" | "request" | "external";

export type ProductAvailabilityStatus = "draft" | "active" | "inactive";

export type ProductAvailabilityRuleType =
  | "weekly"
  | "date_range"
  | "blackout"
  | "minimum_stay"
  | "minimum_notice";

export const PRODUCT_AVAILABILITY_MODE_LABELS: Record<ProductAvailabilityMode, string> = {
  calendar: "Calendario propio",
  request: "A pedido",
  external: "Fuente externa",
};

export const PRODUCT_AVAILABILITY_STATUS_LABELS: Record<ProductAvailabilityStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  inactive: "Inactivo",
};

export const PRODUCT_AVAILABILITY_RULE_TYPE_LABELS: Record<ProductAvailabilityRuleType, string> = {
  weekly: "Semanal",
  date_range: "Rango de fechas",
  blackout: "Bloqueo",
  minimum_stay: "Estadía mínima",
  minimum_notice: "Aviso mínimo",
};

export interface ProductAvailabilityProfile {
  id: string;
  user_id: string;
  product_id: string;
  product_variant_id: string | null;
  name: string;
  availability_mode: ProductAvailabilityMode;
  status: ProductAvailabilityStatus;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductAvailabilityRule {
  id: string;
  availability_profile_id: string;
  rule_type: ProductAvailabilityRuleType;
  day_of_week: number | null;
  start_date: string | null;
  end_date: string | null;
  quantity: number | null;
  status: ProductAvailabilityStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
