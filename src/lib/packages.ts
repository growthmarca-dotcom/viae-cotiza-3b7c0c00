/**
 * Motor de Paquetes Dinámicos — v1.10.5 Fase A (solo tipos y catálogos)
 *
 * Un paquete es una composición de productos existentes del Inventario Global.
 * Representa paquetes prediseñados, generados por reglas y (a futuro)
 * personalizados. NO reserva, NO cobra, NO calcula el precio final.
 */

export const PACKAGE_TEMPLATE_STATUSES = [
  "draft",
  "active",
  "inactive",
  "archived",
] as const;
export type PackageTemplateStatus = (typeof PACKAGE_TEMPLATE_STATUSES)[number];

export const PACKAGE_ITEM_COMPONENT_TYPES = [
  "accommodation",
  "activity",
  "excursion",
  "transfer",
  "rental",
  "other",
] as const;
export type PackageItemComponentType =
  (typeof PACKAGE_ITEM_COMPONENT_TYPES)[number];

export const PACKAGE_RULE_TYPES = [
  "compatibility",
  "exclusion",
  "requirement",
  "recommendation",
  "upgrade",
] as const;
export type PackageRuleType = (typeof PACKAGE_RULE_TYPES)[number];

export const PACKAGE_CONSTRAINT_TYPES = [
  "budget",
  "age",
  "duration",
  "destination",
  "availability",
  "provider",
] as const;
export type PackageConstraintType = (typeof PACKAGE_CONSTRAINT_TYPES)[number];

export const PACKAGE_CONSTRAINT_OPERATORS = [
  "equals",
  "greater_than",
  "less_than",
  "between",
] as const;
export type PackageConstraintOperator =
  (typeof PACKAGE_CONSTRAINT_OPERATORS)[number];

export const PACKAGE_VERSION_STATUSES = [
  "draft",
  "published",
  "retired",
] as const;
export type PackageVersionStatus = (typeof PACKAGE_VERSION_STATUSES)[number];

export const PACKAGE_TEMPLATE_STATUS_LABELS: Record<
  PackageTemplateStatus,
  string
> = {
  draft: "Borrador",
  active: "Activo",
  inactive: "Inactivo",
  archived: "Archivado",
};

export const PACKAGE_ITEM_COMPONENT_TYPE_LABELS: Record<
  PackageItemComponentType,
  string
> = {
  accommodation: "Alojamiento",
  activity: "Actividad",
  excursion: "Excursión",
  transfer: "Traslado",
  rental: "Alquiler",
  other: "Otro",
};

export const PACKAGE_RULE_TYPE_LABELS: Record<PackageRuleType, string> = {
  compatibility: "Compatibilidad",
  exclusion: "Exclusión",
  requirement: "Requisito",
  recommendation: "Recomendación",
  upgrade: "Mejora",
};

export const PACKAGE_CONSTRAINT_TYPE_LABELS: Record<
  PackageConstraintType,
  string
> = {
  budget: "Presupuesto",
  age: "Edad",
  duration: "Duración",
  destination: "Destino",
  availability: "Disponibilidad",
  provider: "Proveedor",
};

export const PACKAGE_CONSTRAINT_OPERATOR_LABELS: Record<
  PackageConstraintOperator,
  string
> = {
  equals: "Igual a",
  greater_than: "Mayor que",
  less_than: "Menor que",
  between: "Entre",
};

export const PACKAGE_VERSION_STATUS_LABELS: Record<
  PackageVersionStatus,
  string
> = {
  draft: "Borrador",
  published: "Publicada",
  retired: "Retirada",
};

/** Fuentes que el motor consumirá y salida que entregará (Fase A: documental). */
export const PACKAGE_ENGINE_INPUTS = [
  "products",
  "pricing_rules",
  "availability_profiles",
  "orchestrator_results",
] as const;
export type PackageEngineInput = (typeof PACKAGE_ENGINE_INPUTS)[number];

export const PACKAGE_ENGINE_INPUT_LABELS: Record<PackageEngineInput, string> = {
  products: "Inventario Global (productos y variantes)",
  pricing_rules: "Reglas tarifarias por producto",
  availability_profiles: "Perfiles de disponibilidad",
  orchestrator_results: "Resultados del Orquestador",
};

export interface PackageTemplate {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  destination_country: string | null;
  destination_state: string | null;
  destination_city: string | null;
  duration_days: number | null;
  status: PackageTemplateStatus;
  priority: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PackageTemplateItem {
  id: string;
  package_template_id: string;
  product_id: string;
  product_variant_id: string | null;
  component_type: PackageItemComponentType;
  required: boolean;
  quantity: number;
  order_index: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PackageRule {
  id: string;
  package_template_id: string;
  rule_type: PackageRuleType;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PackageConstraint {
  id: string;
  package_template_id: string;
  constraint_type: PackageConstraintType;
  operator: PackageConstraintOperator;
  value: Record<string, unknown>;
  created_at: string;
}

export interface PackageVersion {
  id: string;
  package_template_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  status: PackageVersionStatus;
  created_by: string | null;
  created_at: string;
}
