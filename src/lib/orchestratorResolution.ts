/**
 * Motor de Resolución del Orquestador — v1.10.4 Fase B (solo tipos y catálogos)
 *
 * Evalúa candidatos (search_results), aplica reglas, calcula scores y compone
 * paquetes posibles. NO reserva, NO modifica cupos, NO calcula pagos.
 */

export const ORCHESTRATOR_RULE_TYPES = [
  "priority",
  "compatibility",
  "exclusion",
  "preference",
  "package",
] as const;
export type OrchestratorRuleType = (typeof ORCHESTRATOR_RULE_TYPES)[number];

export const ORCHESTRATOR_RULE_SCOPES = [
  "global",
  "destination",
  "product_category",
  "provider",
] as const;
export type OrchestratorRuleScope = (typeof ORCHESTRATOR_RULE_SCOPES)[number];

export const PACKAGE_COMPOSITION_STATUSES = [
  "draft",
  "generated",
  "selected",
  "rejected",
] as const;
export type PackageCompositionStatus =
  (typeof PACKAGE_COMPOSITION_STATUSES)[number];

export const PACKAGE_COMPONENT_TYPES = [
  "accommodation",
  "activity",
  "transfer",
  "rental",
  "other",
] as const;
export type PackageComponentType = (typeof PACKAGE_COMPONENT_TYPES)[number];

export const PROVIDER_PREFERENCE_TYPES = [
  "preferred",
  "blocked",
  "priority",
  "commission",
  "quality",
] as const;
export type ProviderPreferenceType =
  (typeof PROVIDER_PREFERENCE_TYPES)[number];

export const ORCHESTRATOR_RULE_TYPE_LABELS: Record<
  OrchestratorRuleType,
  string
> = {
  priority: "Prioridad",
  compatibility: "Compatibilidad",
  exclusion: "Exclusión",
  preference: "Preferencia",
  package: "Armado de paquete",
};

export const ORCHESTRATOR_RULE_SCOPE_LABELS: Record<
  OrchestratorRuleScope,
  string
> = {
  global: "Global",
  destination: "Por destino",
  product_category: "Por categoría de producto",
  provider: "Por proveedor",
};

export const PACKAGE_COMPOSITION_STATUS_LABELS: Record<
  PackageCompositionStatus,
  string
> = {
  draft: "Borrador",
  generated: "Generado",
  selected: "Seleccionado",
  rejected: "Rechazado",
};

export const PACKAGE_COMPONENT_TYPE_LABELS: Record<
  PackageComponentType,
  string
> = {
  accommodation: "Alojamiento",
  activity: "Actividad",
  transfer: "Traslado",
  rental: "Alquiler",
  other: "Otro",
};

export const PROVIDER_PREFERENCE_TYPE_LABELS: Record<
  ProviderPreferenceType,
  string
> = {
  preferred: "Preferido",
  blocked: "Bloqueado",
  priority: "Prioridad",
  commission: "Comisión",
  quality: "Calidad",
};

/**
 * Dimensiones del score y su peso de referencia (Fase B: documental).
 * El cálculo real se implementará en una fase posterior.
 */
export const SCORE_DIMENSIONS = [
  "availability_score",
  "pricing_score",
  "provider_score",
  "quality_score",
] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export const SCORE_DIMENSION_LABELS: Record<ScoreDimension, string> = {
  availability_score: "Disponibilidad",
  pricing_score: "Precio",
  provider_score: "Proveedor",
  quality_score: "Calidad",
};

export const SCORE_REFERENCE_WEIGHTS: Record<ScoreDimension, number> = {
  availability_score: 0.4,
  pricing_score: 0.3,
  provider_score: 0.2,
  quality_score: 0.1,
};

/** Etapas de resolución obligatorias (Fase B: documental). */
export const RESOLUTION_STEPS = [
  "receive_candidates",
  "validate_compatibility",
  "apply_rules",
  "calculate_score",
  "compose_packages",
  "return_options",
] as const;
export type ResolutionStep = (typeof RESOLUTION_STEPS)[number];

export const RESOLUTION_STEP_LABELS: Record<ResolutionStep, string> = {
  receive_candidates: "1. Recibe candidatos",
  validate_compatibility: "2. Valida compatibilidad",
  apply_rules: "3. Aplica reglas",
  calculate_score: "4. Calcula score",
  compose_packages: "5. Genera combinaciones",
  return_options: "6. Devuelve opciones",
};

export interface OrchestratorRule {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  rule_type: OrchestratorRuleType;
  scope: OrchestratorRuleScope;
  priority: number;
  active: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrchestratorScore {
  id: string;
  search_request_id: string;
  search_result_id: string;
  availability_score: number | null;
  pricing_score: number | null;
  provider_score: number | null;
  quality_score: number | null;
  final_score: number | null;
  calculation_metadata: Record<string, unknown>;
  created_at: string;
}

export interface PackageComposition {
  id: string;
  search_request_id: string;
  name: string | null;
  status: PackageCompositionStatus;
  total_amount: number | null;
  currency: string | null;
  score: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PackageComponent {
  id: string;
  package_id: string;
  search_result_id: string;
  component_type: PackageComponentType;
  order_index: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProviderPreference {
  id: string;
  user_id: string;
  organization_id: string;
  provider_id: string | null;
  preference_type: ProviderPreferenceType;
  value: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}
