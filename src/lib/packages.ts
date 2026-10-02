/**
 * Motor de Paquetes Dinámicos — v1.10.5 Fase A (solo tipos y catálogos)
 *
 * Un paquete es una composición de productos existentes del Inventario Global.
 * Representa paquetes prediseñados, generados por reglas y (a futuro)
 * personalizados. NO reserva, NO cobra, NO calcula el precio final.
 */

import { supabase } from "@/integrations/supabase/client";
import { lastQuotedByPackage, type LastQuoted } from "@/lib/packageApply";

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

/* ------------------------------------------------------------------ */
/* Módulo Paquetes (plantillas reutilizables de productos del Catálogo) */
/* ------------------------------------------------------------------ */

export type PackageListRow = PackageTemplate & {
  item_count: number;
  last_quoted: LastQuoted | null;
};

export type PackageInput = {
  organization_id: string;
  name: string;
  description: string | null;
  destination_city: string | null;
  destination_state: string | null;
  destination_country: string | null;
  duration_days: number | null;
  status: PackageTemplateStatus;
  priority: number;
  notes: string | null;
};

export type PackageItemInput = {
  product_id: string;
  component_type: PackageItemComponentType;
  quantity: number;
  required: boolean;
  order_index: number;
};

function friendlyPkg(e: { code?: string; message: string }) {
  if (e.code === "42501") return new Error("No tenés permisos para modificar paquetes de esta agencia.");
  return new Error(e.message);
}

export function packageDestinationLabel(p: Pick<PackageTemplate, "destination_city" | "destination_state" | "destination_country">) {
  return [p.destination_city, p.destination_state, p.destination_country].filter(Boolean).join(", ");
}

async function lastQuotedFor(ids: string[]) {
  if (!ids.length) return new Map<string, LastQuoted>();
  const { data } = await supabase
    .from("quotations")
    .select("id, quotation_number, total_amount, currency, created_at, pax_count, nights, package_template_id")
    .in("package_template_id", ids)
    .order("created_at", { ascending: false })
    .limit(500);
  return lastQuotedByPackage(
    (data ?? []).map((q) => ({
      package_template_id: q.package_template_id,
      quotation_id: q.id,
      quotation_number: q.quotation_number,
      total_amount: q.total_amount != null ? Number(q.total_amount) : null,
      currency: q.currency,
      created_at: q.created_at,
      pax_count: q.pax_count,
      nights: q.nights,
    })),
  );
}

export async function listPackages(): Promise<PackageListRow[]> {
  const { data, error } = await supabase
    .from("package_templates")
    .select("*, items:package_template_items(count)")
    .order("priority")
    .order("name");
  if (error) throw friendlyPkg(error);
  const rows = (data ?? []) as unknown as (PackageTemplate & { items: { count: number }[] })[];
  const last = await lastQuotedFor(rows.map((r) => r.id));
  return rows.map(({ items, ...r }) => ({
    ...r,
    item_count: items?.[0]?.count ?? 0,
    last_quoted: last.get(r.id) ?? null,
  }));
}

export async function getPackage(id: string) {
  const { data, error } = await supabase.from("package_templates").select("*").eq("id", id).maybeSingle();
  if (error) throw friendlyPkg(error);
  if (!data) return null;
  const { data: items, error: e2 } = await supabase
    .from("package_template_items")
    .select("*")
    .eq("package_template_id", id)
    .order("order_index");
  if (e2) throw friendlyPkg(e2);
  const last = await lastQuotedFor([id]);
  return {
    pkg: data as unknown as PackageTemplate,
    items: (items ?? []) as unknown as PackageTemplateItem[],
    last_quoted: last.get(id) ?? null,
  };
}

export function validatePackage(i: PackageInput, items: PackageItemInput[]): string | null {
  if (!i.name.trim()) return "Ingresá el nombre del paquete.";
  if (i.duration_days != null && (i.duration_days < 0 || !Number.isInteger(i.duration_days)))
    return "La duración debe ser un número entero de días.";
  if (items.some((it) => !(it.quantity > 0))) return "Cada producto debe tener una cantidad mayor a 0.";
  return null;
}

function headerRow(i: PackageInput) {
  return {
    organization_id: i.organization_id,
    name: i.name.trim(),
    description: i.description?.trim() || null,
    destination_city: i.destination_city?.trim() || null,
    destination_state: i.destination_state?.trim() || null,
    destination_country: i.destination_country?.trim() || null,
    duration_days: i.duration_days,
    status: i.status,
    priority: i.priority,
    metadata: i.notes?.trim() ? { notes: i.notes.trim() } : {},
  };
}

async function replaceItems(id: string, items: PackageItemInput[]) {
  const { error: d } = await supabase.from("package_template_items").delete().eq("package_template_id", id);
  if (d) throw friendlyPkg(d);
  if (!items.length) return;
  const { error } = await supabase.from("package_template_items").insert(
    items.map((it, idx) => ({
      package_template_id: id,
      product_id: it.product_id,
      component_type: it.component_type,
      quantity: it.quantity,
      required: it.required,
      order_index: idx,
    })),
  );
  if (error) throw friendlyPkg(error);
}

export async function createPackage(i: PackageInput, items: PackageItemInput[]): Promise<string> {
  const msg = validatePackage(i, items);
  if (msg) throw new Error(msg);
  const { data, error } = await supabase.from("package_templates").insert(headerRow(i)).select("id").single();
  if (error) throw friendlyPkg(error);
  await replaceItems(data.id, items);
  return data.id;
}

export async function updatePackage(id: string, i: PackageInput, items: PackageItemInput[]) {
  const msg = validatePackage(i, items);
  if (msg) throw new Error(msg);
  const { error } = await supabase
    .from("package_templates")
    .update({ ...headerRow(i), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw friendlyPkg(error);
  await replaceItems(id, items);
}

export async function setPackageStatus(id: string, status: PackageTemplateStatus) {
  const { error } = await supabase
    .from("package_templates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw friendlyPkg(error);
}

/** Duplica cabecera + referencias a productos (nunca los productos). Nace en borrador. */
export async function duplicatePackage(id: string): Promise<string> {
  const full = await getPackage(id);
  if (!full) throw new Error("Paquete no encontrado.");
  const p = full.pkg;
  const { data, error } = await supabase
    .from("package_templates")
    .insert({
      organization_id: p.organization_id,
      name: `${p.name} (copia)`,
      description: p.description,
      destination_city: p.destination_city,
      destination_state: p.destination_state,
      destination_country: p.destination_country,
      duration_days: p.duration_days,
      status: "draft",
      priority: p.priority,
      metadata: p.metadata as never,
    })
    .select("id")
    .single();
  if (error) throw friendlyPkg(error);
  await replaceItems(
    data.id,
    full.items.map((it) => ({
      product_id: it.product_id,
      component_type: it.component_type,
      quantity: Number(it.quantity),
      required: it.required,
      order_index: it.order_index,
    })),
  );
  return data.id;
}
