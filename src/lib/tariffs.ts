import type { Enums, Tables } from "@/integrations/supabase/types";

/**
 * Motor Tarifario Multiproveedor — v1.9.6 Fase 0 (solo estructura).
 *
 * Esta capa define únicamente los tipos y catálogos de referencia del motor
 * tarifario. NO calcula precios, no lee ni escribe en la base y no interviene
 * en reservas, cotizaciones, transporte ni comisiones.
 *
 * El cálculo (resolución de plan → temporada → categoría → condiciones)
 * llegará en una fase posterior, del lado de la base de datos, siguiendo el
 * mismo criterio que `resolve_agreement`.
 */

export type TariffPlan = Tables<"tariff_plans">;
export type TariffSeason = Tables<"tariff_seasons">;
export type TariffRule = Tables<"tariff_rules">;
export type TariffRuleCondition = Tables<"tariff_rule_conditions">;
export type PassengerCategory = Tables<"passenger_categories">;

export type TariffStatus = Enums<"tariff_status">;
export type TariffSeasonType = Enums<"tariff_season_type">;
export type TariffConditionType = Enums<"tariff_condition_type">;

export const TARIFF_STATUSES: { value: TariffStatus; label: string }[] = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "archived", label: "Archivado" },
];

export const TARIFF_SEASON_TYPES: { value: TariffSeasonType; label: string }[] = [
  { value: "high", label: "Alta" },
  { value: "mid", label: "Media" },
  { value: "low", label: "Baja" },
  { value: "special", label: "Especial" },
];

export const TARIFF_CONDITION_TYPES: {
  value: TariffConditionType;
  label: string;
  hint: string;
}[] = [
  { value: "nights", label: "Noches", hint: "Cantidad de noches del servicio" },
  { value: "operating_days", label: "Días de operación", hint: "Días de la semana habilitados" },
  { value: "min_advance_days", label: "Anticipación mínima", hint: "Días de anticipación de la venta" },
  { value: "group_size", label: "Grupo", hint: "Cantidad de pasajeros del grupo" },
  { value: "promotion", label: "Promoción", hint: "Condición promocional" },
  { value: "restriction", label: "Restricción", hint: "Condición que bloquea la tarifa" },
  { value: "other", label: "Otra", hint: "Condición libre" },
];

/** Operadores admitidos por `tariff_rule_conditions.operator`. */
export const TARIFF_CONDITION_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "in",
  "not_in",
] as const;

export type TariffConditionOperator = (typeof TARIFF_CONDITION_OPERATORS)[number];

/**
 * Categorías de pasajero de referencia. Las edades son configurables por
 * organización: estos valores son solo la propuesta inicial del catálogo.
 */
export const DEFAULT_PASSENGER_CATEGORIES: {
  code: string;
  label: string;
  passenger_type: Enums<"passenger_type"> | null;
  min_age: number | null;
  max_age: number | null;
  occupies_seat: boolean;
  is_free: boolean;
}[] = [
  { code: "adult", label: "Adulto", passenger_type: "adult", min_age: 18, max_age: 64, occupies_seat: true, is_free: false },
  { code: "child", label: "Niño", passenger_type: "child", min_age: 3, max_age: 11, occupies_seat: true, is_free: false },
  { code: "infant", label: "Infante", passenger_type: "infant", min_age: 0, max_age: 2, occupies_seat: false, is_free: true },
  { code: "senior", label: "Senior", passenger_type: "senior", min_age: 65, max_age: null, occupies_seat: true, is_free: false },
  { code: "resident", label: "Residente", passenger_type: "other", min_age: null, max_age: null, occupies_seat: true, is_free: false },
  { code: "student", label: "Estudiante", passenger_type: "other", min_age: null, max_age: null, occupies_seat: true, is_free: false },
  { code: "guide", label: "Guía", passenger_type: "other", min_age: null, max_age: null, occupies_seat: true, is_free: true },
  { code: "coordinator", label: "Coordinador", passenger_type: "other", min_age: null, max_age: null, occupies_seat: true, is_free: true },
  { code: "free", label: "Free", passenger_type: "other", min_age: null, max_age: null, occupies_seat: true, is_free: true },
  { code: "driver", label: "Chofer", passenger_type: "other", min_age: null, max_age: null, occupies_seat: false, is_free: true },
];

export function tariffStatusLabel(value: TariffStatus | null) {
  if (!value) return "—";
  return TARIFF_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function tariffSeasonTypeLabel(value: TariffSeasonType | null) {
  if (!value) return "—";
  return TARIFF_SEASON_TYPES.find((s) => s.value === value)?.label ?? value;
}

export function tariffConditionTypeLabel(value: TariffConditionType | null) {
  if (!value) return "—";
  return TARIFF_CONDITION_TYPES.find((c) => c.value === value)?.label ?? value;
}
