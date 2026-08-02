/**
 * Motor de Reglas Tarifarias por Producto — v1.10.1 Fase A (solo tipos).
 *
 * Esta capa describe CÓMO se podría tarifar un producto del Inventario Global
 * (por pasajero, por grupo, por temporada, suplementos y descuentos).
 *
 * NO calcula precios, NO reemplaza el módulo de cotizaciones y NO consulta
 * disponibilidad. Solo define la estructura que luego consumirán cotizaciones,
 * el orquestador multiproveedor, el marketplace y el white label.
 */

export type PricingProfileStatus = "draft" | "active" | "inactive" | "archived";

export type PricingRuleType =
  | "passenger"
  | "group"
  | "seasonal"
  | "fixed"
  | "percentage"
  | "supplement"
  | "discount";

export type PricingPassengerType = "adult" | "child" | "infant" | "senior" | "any";

export type PricingCalculationType = "fixed_amount" | "percentage" | "per_unit";

export type PricingConditionType =
  | "day_of_week"
  | "destination"
  | "booking_window"
  | "nationality"
  | "partner"
  | "organization";

export type PricingConditionOperator = "equals" | "between" | "greater_than" | "less_than";

export const PRICING_PROFILE_STATUS_LABELS: Record<PricingProfileStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  inactive: "Inactivo",
  archived: "Archivado",
};

export const PRICING_RULE_TYPE_LABELS: Record<PricingRuleType, string> = {
  passenger: "Por pasajero",
  group: "Por grupo",
  seasonal: "Por temporada",
  fixed: "Monto fijo",
  percentage: "Porcentaje",
  supplement: "Suplemento",
  discount: "Descuento",
};

export const PRICING_PASSENGER_TYPE_LABELS: Record<PricingPassengerType, string> = {
  adult: "Adulto",
  child: "Niño",
  infant: "Infante",
  senior: "Tercera edad",
  any: "Cualquiera",
};

export const PRICING_CALCULATION_TYPE_LABELS: Record<PricingCalculationType, string> = {
  fixed_amount: "Monto fijo",
  percentage: "Porcentaje",
  per_unit: "Por unidad",
};

export const PRICING_CONDITION_TYPE_LABELS: Record<PricingConditionType, string> = {
  day_of_week: "Día de la semana",
  destination: "Destino",
  booking_window: "Ventana de reserva",
  nationality: "Nacionalidad",
  partner: "Socio comercial",
  organization: "Organización",
};

export const PRICING_CONDITION_OPERATOR_LABELS: Record<PricingConditionOperator, string> = {
  equals: "Igual a",
  between: "Entre",
  greater_than: "Mayor que",
  less_than: "Menor que",
};

export interface ProductPricingProfile {
  id: string;
  user_id: string;
  product_id: string;
  product_variant_id: string | null;
  name: string;
  currency: string;
  status: PricingProfileStatus;
  valid_from: string | null;
  valid_until: string | null;
  priority: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  pricing_profile_id: string;
  rule_type: PricingRuleType;
  passenger_type: PricingPassengerType;
  min_age: number | null;
  max_age: number | null;
  min_quantity: number | null;
  max_quantity: number | null;
  season_code: string | null;
  calculation_type: PricingCalculationType;
  value: number;
  currency: string | null;
  priority: number;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PassengerPricingGroup {
  id: string;
  pricing_profile_id: string;
  name: string;
  adult_min: number | null;
  adult_max: number | null;
  child_min: number | null;
  child_max: number | null;
  infant_min: number | null;
  infant_max: number | null;
  description: string | null;
  created_at: string;
}

export interface PricingCondition {
  id: string;
  pricing_profile_id: string;
  condition_type: PricingConditionType;
  operator: PricingConditionOperator;
  value: Record<string, unknown>;
  created_at: string;
}
