import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Catálogo inteligente de recursos (v1.8.2).
 *
 * Clasificación principal (persona / vehículo / empresa / equipamiento),
 * subtipos por clase, propietario del recurso y catálogo configurable de
 * extras (con vínculo por recurso y solicitud por servicio de transporte).
 */

export type ResourceClass = "person" | "vehicle" | "company" | "equipment";
export type ResourceOwnerType = "viae" | "provider" | "partner_company" | "private" | "other";

export type ResourceExtra = Tables<"resource_extras">;
export type ResourceExtraLink = Tables<"resource_extra_links">;
export type TransportServiceExtra = Tables<"transport_service_extras">;

export const RESOURCE_CLASSES: { value: ResourceClass; label: string; hint: string }[] = [
  { value: "person", label: "Persona", hint: "Choferes, guías, coordinadores y representantes" },
  { value: "vehicle", label: "Vehículo", hint: "Autos, vans, buses, embarcaciones y bicicletas" },
  { value: "company", label: "Empresa", hint: "Hoteles, rentadoras, operadores y proveedores" },
  { value: "equipment", label: "Equipamiento", hint: "Preparado para futuro" },
];

export const RESOURCE_SUBTYPES: Record<ResourceClass, { value: string; label: string }[]> = {
  person: [
    { value: "driver", label: "Chofer" },
    { value: "guide", label: "Guía" },
    { value: "coordinator", label: "Coordinador" },
    { value: "representative", label: "Representante" },
    { value: "other", label: "Otro" },
  ],
  vehicle: [
    { value: "taxi", label: "Taxi" },
    { value: "remis", label: "Remís" },
    { value: "transfer", label: "Transfer" },
    { value: "rental_car", label: "Auto de alquiler" },
    { value: "suv", label: "SUV" },
    { value: "offroad_4x4", label: "4x4" },
    { value: "minivan", label: "Minivan" },
    { value: "minibus", label: "Minibús" },
    { value: "bus", label: "Bus" },
    { value: "boat", label: "Lancha" },
    { value: "catamaran", label: "Catamarán" },
    { value: "bicycle", label: "Bicicleta" },
    { value: "other", label: "Otro" },
  ],
  company: [
    { value: "car_rental", label: "Rentadora" },
    { value: "transfer_company", label: "Empresa de traslados" },
    { value: "hotel", label: "Hotel" },
    { value: "excursion_provider", label: "Prestador de excursiones" },
    { value: "tour_operator", label: "Operador turístico" },
    { value: "supplier", label: "Proveedor" },
    { value: "other", label: "Otro" },
  ],
  equipment: [{ value: "other", label: "Otro" }],
};

export const RESOURCE_OWNER_TYPES: { value: ResourceOwnerType; label: string }[] = [
  { value: "viae", label: "ViaE" },
  { value: "provider", label: "Proveedor" },
  { value: "partner_company", label: "Empresa asociada" },
  { value: "private", label: "Particular" },
  { value: "other", label: "Otro" },
];

export const VEHICLE_FUELS = [
  { value: "gasoline", label: "Nafta" },
  { value: "diesel", label: "Diésel" },
  { value: "gnc", label: "GNC" },
  { value: "hybrid", label: "Híbrido" },
  { value: "electric", label: "Eléctrico" },
  { value: "other", label: "Otro" },
];

export const VEHICLE_TRANSMISSIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automática" },
  { value: "other", label: "Otra" },
];

export function resourceClassLabel(value: string | null | undefined) {
  return RESOURCE_CLASSES.find((c) => c.value === value)?.label ?? "—";
}

export function subtypeLabel(cls: string | null | undefined, value: string | null | undefined) {
  if (!value) return "—";
  const list = RESOURCE_SUBTYPES[(cls ?? "company") as ResourceClass] ?? [];
  return (
    list.find((s) => s.value === value)?.label ??
    Object.values(RESOURCE_SUBTYPES)
      .flat()
      .find((s) => s.value === value)?.label ??
    value
  );
}

export function ownerTypeLabel(value: string | null | undefined) {
  return RESOURCE_OWNER_TYPES.find((o) => o.value === value)?.label ?? "—";
}

export function fuelLabel(value: string | null | undefined) {
  return VEHICLE_FUELS.find((f) => f.value === value)?.label ?? value ?? "—";
}

export function transmissionLabel(value: string | null | undefined) {
  return VEHICLE_TRANSMISSIONS.find((t) => t.value === value)?.label ?? value ?? "—";
}

/** Sugerencias del catálogo de extras para el arranque del módulo. */
export const SUGGESTED_EXTRAS = [
  "Cadenas para nieve",
  "Silla bebé",
  "Silla infantil",
  "Booster",
  "Portaesquí",
  "Portabicicletas",
  "GPS",
  "WiFi",
  "Conservadora",
  "Mascotas permitidas",
  "Equipaje extra",
  "Otro",
] as const;

// ------------------------------------------------------------- extras (catálogo)

export type ExtraInput = {
  name: string;
  description: string;
  record_status: "active" | "archived" | "inactive" | "suspended";
  price: string;
  cost: string;
  currency: string;
  is_included: boolean;
  quantity_available: string;
};

export const EMPTY_EXTRA: ExtraInput = {
  name: "",
  description: "",
  record_status: "active",
  price: "",
  cost: "",
  currency: "ARS",
  is_included: false,
  quantity_available: "",
};

export function extraToInput(e: ResourceExtra): ExtraInput {
  return {
    name: e.name ?? "",
    description: e.description ?? "",
    record_status: e.record_status as ExtraInput["record_status"],
    price: e.price != null ? String(e.price) : "",
    cost: e.cost != null ? String(e.cost) : "",
    currency: e.currency ?? "ARS",
    is_included: e.is_included ?? false,
    quantity_available: e.quantity_available != null ? String(e.quantity_available) : "",
  };
}

const txt = (v: string) => (v.trim() === "" ? null : v.trim());
const num = (v: string) => (v.trim() === "" ? null : Number(v));

function extraPayload(input: ExtraInput) {
  return {
    name: input.name.trim(),
    description: txt(input.description),
    record_status: input.record_status,
    price: num(input.price),
    cost: num(input.cost),
    currency: input.currency || "ARS",
    is_included: input.is_included,
    quantity_available: num(input.quantity_available),
  };
}

export async function listExtras(includeArchived = false): Promise<ResourceExtra[]> {
  let q = supabase.from("resource_extras").select("*").order("name", { ascending: true });
  if (!includeArchived) q = q.eq("record_status", "active");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ResourceExtra[];
}

export async function createExtra(input: ExtraInput): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { data, error } = await supabase
    .from("resource_extras")
    .insert({ ...extraPayload(input), user_id: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateExtra(id: string, input: ExtraInput) {
  const { error } = await supabase.from("resource_extras").update(extraPayload(input)).eq("id", id);
  if (error) throw error;
}

/** Los extras nunca se eliminan: cambian de estado. */
export async function setExtraStatus(id: string, record_status: ExtraInput["record_status"]) {
  const { error } = await supabase.from("resource_extras").update({ record_status }).eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------- extras por recurso

export async function listResourceExtras(resourceId: string): Promise<ResourceExtraLink[]> {
  const { data, error } = await supabase
    .from("resource_extra_links")
    .select("*")
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ResourceExtraLink[];
}

export async function listAllResourceExtras(): Promise<ResourceExtraLink[]> {
  const { data, error } = await supabase.from("resource_extra_links").select("*");
  if (error) throw error;
  return (data ?? []) as ResourceExtraLink[];
}

export async function upsertResourceExtra(params: {
  resourceId: string;
  extraId: string;
  quantity: number;
  extraCost: number | null;
  currency: string;
  isIncluded: boolean;
  notes?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { error } = await supabase.from("resource_extra_links").upsert(
    {
      user_id: uid,
      resource_id: params.resourceId,
      extra_id: params.extraId,
      quantity: params.quantity,
      extra_cost: params.extraCost,
      currency: params.currency,
      is_included: params.isIncluded,
      notes: params.notes?.trim() || null,
    },
    { onConflict: "resource_id,extra_id" },
  );
  if (error) throw error;
}

export async function removeResourceExtra(id: string) {
  const { error } = await supabase.from("resource_extra_links").delete().eq("id", id);
  if (error) throw error;
}

// -------------------------------------------------------- extras en los servicios

export async function listServiceExtras(serviceId: string): Promise<TransportServiceExtra[]> {
  const { data, error } = await supabase
    .from("transport_service_extras")
    .select("*")
    .eq("service_id", serviceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TransportServiceExtra[];
}

export async function listServiceExtrasFor(
  serviceIds: string[],
): Promise<Map<string, TransportServiceExtra[]>> {
  const map = new Map<string, TransportServiceExtra[]>();
  if (serviceIds.length === 0) return map;
  const { data, error } = await supabase
    .from("transport_service_extras")
    .select("*")
    .in("service_id", serviceIds);
  if (error) throw error;
  for (const row of (data ?? []) as TransportServiceExtra[]) {
    const list = map.get(row.service_id) ?? [];
    list.push(row);
    map.set(row.service_id, list);
  }
  return map;
}

export async function addServiceExtra(params: {
  serviceId: string;
  extraId: string;
  quantity: number;
  isRequired: boolean;
  notes?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { error } = await supabase.from("transport_service_extras").insert({
    user_id: uid,
    service_id: params.serviceId,
    extra_id: params.extraId,
    quantity: params.quantity,
    is_required: params.isRequired,
    notes: params.notes?.trim() || null,
  });
  if (error) throw error;
}

export async function removeServiceExtra(id: string) {
  const { error } = await supabase.from("transport_service_extras").delete().eq("id", id);
  if (error) throw error;
}

/** Ranking simple de extras más utilizados en servicios. */
export function topExtras(
  links: TransportServiceExtra[],
  extras: ResourceExtra[],
  limit = 5,
): { name: string; count: number }[] {
  const names = new Map(extras.map((e) => [e.id, e.name]));
  const counts = new Map<string, number>();
  for (const l of links) {
    const name = names.get(l.extra_id) ?? "Extra";
    counts.set(name, (counts.get(name) ?? 0) + (l.quantity ?? 1));
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
