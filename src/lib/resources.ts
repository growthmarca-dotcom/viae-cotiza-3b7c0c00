import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { TransportServiceType, VehicleType } from "@/lib/transport";
import type { ResourceClass, ResourceOwnerType } from "@/lib/resource-catalog";



/**
 * Módulo de Recursos Operativos (v1.0).
 * Empresas (internas / externas) y los recursos que ofrecen: alojamientos,
 * vehículos, guías, excursiones, seguros y agentes como recurso humano.
 */

export type Company = Tables<"companies">;
export type Resource = Tables<"resources">;
export type BookingResource = Tables<"booking_resources">;

export type CompanyKind = "internal" | "external";
export type RecordStatus = "active" | "archived" | "inactive" | "suspended";
export type ResourceAvailability =
  | "available"
  | "assigned"
  | "busy"
  | "reserved"
  | "in_service"
  | "unavailable"
  | "out_of_service"
  | "off_hours";

export type ResourceCategory =
  | "accommodation"
  | "room"
  | "vehicle"
  | "driver"
  | "taxi"
  | "transfer"
  | "excursion"
  | "guide"
  | "insurance"
  | "rental"
  | "tourism_service"
  | "agent"
  | "other";

export const COMPANY_KINDS: { value: CompanyKind; label: string }[] = [
  { value: "internal", label: "Interna" },
  { value: "external", label: "Externa" },
];

export const RESOURCE_CATEGORIES: { value: ResourceCategory; label: string }[] = [
  { value: "accommodation", label: "Alojamiento" },
  { value: "room", label: "Habitación / unidad" },
  { value: "vehicle", label: "Vehículo" },
  { value: "driver", label: "Chofer" },
  { value: "taxi", label: "Taxi / remis" },
  { value: "transfer", label: "Traslado" },
  { value: "excursion", label: "Excursión" },
  { value: "guide", label: "Guía" },
  { value: "insurance", label: "Seguro" },
  { value: "rental", label: "Alquiler" },
  { value: "tourism_service", label: "Servicio turístico" },
  { value: "agent", label: "Agente (recurso humano)" },
  { value: "other", label: "Otro" },
];

export const RESOURCE_AVAILABILITIES: { value: ResourceAvailability; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "assigned", label: "Asignado" },
  { value: "busy", label: "En viaje / ocupado" },
  { value: "reserved", label: "Reservado" },
  { value: "in_service", label: "En servicio" },
  { value: "unavailable", label: "No disponible" },
  { value: "off_hours", label: "Fuera de horario" },
  { value: "out_of_service", label: "Fuera de servicio" },
];

/** Estados operativos propios del conductor (v1.3). */
export const DRIVER_AVAILABILITIES: { value: ResourceAvailability; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "assigned", label: "Asignado" },
  { value: "busy", label: "En viaje" },
  { value: "unavailable", label: "No disponible" },
  { value: "off_hours", label: "Fuera de horario" },
];

/** Estados operativos propios del vehículo (v1.3). */
export const VEHICLE_AVAILABILITIES: { value: ResourceAvailability; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "reserved", label: "Reservado" },
  { value: "in_service", label: "En servicio" },
  { value: "out_of_service", label: "Fuera de servicio" },
];



export type AgentAvailability = "available" | "busy" | "unavailable" | "off_hours";

export const AGENT_AVAILABILITIES: { value: AgentAvailability; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "busy", label: "Ocupado" },
  { value: "unavailable", label: "No disponible" },
  { value: "off_hours", label: "Fuera de horario" },
];

export const RECORD_STATUSES: { value: RecordStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "archived", label: "Archivado" },
  { value: "inactive", label: "Inactivo" },
  { value: "suspended", label: "Suspendido" },
];

export const RESOURCE_ZONES = [
  "Bariloche",
  "Patagonia",
  "Cuyo",
  "Litoral",
  "Norte argentino",
  "Buenos Aires",
  "Chile",
  "Brasil",
  "Internacional",
  "Otra",
] as const;

export const RESOURCE_SPECIALTIES = [
  "Ski",
  "Aventura",
  "Familias",
  "Grupos",
  "Corporativo",
  "Lujo",
  "Accesible",
  "Idiomas",
  "Alta montaña",
  "Otro",
] as const;

export function companyKindLabel(value: string) {
  return COMPANY_KINDS.find((k) => k.value === value)?.label ?? value;
}

export function categoryLabel(value: string) {
  return RESOURCE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function availabilityLabel(value: string) {
  return RESOURCE_AVAILABILITIES.find((a) => a.value === value)?.label ?? value;
}

export function agentAvailabilityLabel(value: string) {
  return AGENT_AVAILABILITIES.find((a) => a.value === value)?.label ?? value;
}

export function recordStatusLabel(value: string) {
  return RECORD_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function availabilityClasses(value: string) {
  switch (value) {
    case "available":
      return "bg-primary/10 text-primary border-primary/30";
    case "busy":
    case "in_service":
      return "bg-gold/15 text-foreground border-gold/40";
    case "assigned":
    case "reserved":
      return "bg-gold/10 text-foreground border-gold/30";
    case "unavailable":
    case "out_of_service":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Estados operativos según el tipo de recurso (conductor o vehículo). */
export function availabilityOptionsFor(category: string) {
  if (category === "vehicle") return VEHICLE_AVAILABILITIES;
  if (category === "driver" || category === "taxi" || category === "transfer")
    return DRIVER_AVAILABILITIES;
  return RESOURCE_AVAILABILITIES;
}

// ------------------------------------------------------------------ empresas

export type CompanyInput = {
  name: string;
  kind: CompanyKind;
  contact_name: string;
  email: string;
  whatsapp: string;
  city: string;
  state: string;
  country: string;
  notes: string;
  record_status: RecordStatus;
};

export const EMPTY_COMPANY: CompanyInput = {
  name: "",
  kind: "external",
  contact_name: "",
  email: "",
  whatsapp: "",
  city: "",
  state: "",
  country: "",
  notes: "",
  record_status: "active",
};

export function companyToInput(c: Company): CompanyInput {
  return {
    name: c.name ?? "",
    kind: c.kind as CompanyKind,
    contact_name: c.contact_name ?? "",
    email: c.email ?? "",
    whatsapp: c.whatsapp ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    country: c.country ?? "",
    notes: c.notes ?? "",
    record_status: c.record_status as RecordStatus,
  };
}

const text = (v: string) => (v.trim() === "" ? null : v.trim());

function companyPayload(input: CompanyInput) {
  return {
    name: input.name.trim(),
    kind: input.kind,
    contact_name: text(input.contact_name),
    email: text(input.email),
    whatsapp: text(input.whatsapp),
    city: text(input.city),
    state: text(input.state),
    country: text(input.country),
    notes: text(input.notes),
    record_status: input.record_status,
  };
}

export async function listCompanies(includeArchived = false): Promise<Company[]> {
  let q = supabase.from("companies").select("*").order("name", { ascending: true });
  if (!includeArchived) q = q.eq("record_status", "active");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Company[];
}

export async function getCompany(id: string): Promise<Company | null> {
  const { data, error } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Company) ?? null;
}

export async function createCompany(input: CompanyInput): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { data, error } = await supabase
    .from("companies")
    .insert({ ...companyPayload(input), user_id: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateCompany(id: string, input: CompanyInput) {
  const { error } = await supabase.from("companies").update(companyPayload(input)).eq("id", id);
  if (error) throw error;
}

/** Las empresas nunca se eliminan: cambian de estado. */
export async function setCompanyStatus(id: string, record_status: RecordStatus) {
  const { error } = await supabase.from("companies").update({ record_status }).eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------------ recursos

export type ResourceInput = {
  name: string;
  kind: CompanyKind;
  category: ResourceCategory;
  /** Clasificación principal del catálogo (v1.8.2). */
  resource_class: ResourceClass;
  /** Subtipo dependiente de la clasificación. */
  subtype: string;
  /** Propietario del recurso (v1.8.2). */
  owner_type: ResourceOwnerType;
  owner_company_id: string;
  owner_name: string;
  /** Vehículo sin conductor (rent a car). */
  self_drive: boolean;
  company_id: string;

  agent_id: string;
  description: string;
  contact_name: string;
  email: string;
  whatsapp: string;
  main_zone: string;
  zones: string[];
  specialties: string[];
  pax_capacity: string;
  unit_count: string;
  operating_limit: string;
  availability: ResourceAvailability;
  record_status: RecordStatus;
  notes: string;
  // --- red de transporte (v1.1): ubicación operativa
  base_city: string;
  state: string;
  country: string;
  cities_served: string[];
  destinations: string[];
  /** Zonas turísticas donde opera (catálogo geográfico, v1.4). */
  tourist_zones: string[];
  max_distance_km: string;
  requires_advance_booking: boolean;
  advance_notice_hours: string;
  transport_service_types: TransportServiceType[];
  // --- datos del conductor
  driver_first_name: string;
  driver_last_name: string;
  // --- datos del vehículo
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_version: string;
  vehicle_year: string;
  vehicle_plate: string;
  vehicle_color: string;
  vehicle_type: VehicleType | "";
  vehicle_fuel: string;
  vehicle_transmission: string;
  luggage_capacity: string;
  large_luggage_capacity: string;
  cabin_luggage_capacity: string;
  is_accessible: boolean;
  has_air_conditioning: boolean;
  vehicle_notes: string;
};

export const EMPTY_RESOURCE: ResourceInput = {
  name: "",
  kind: "external",
  category: "accommodation",
  resource_class: "company",
  subtype: "",
  owner_type: "viae",
  owner_company_id: "",
  owner_name: "",
  self_drive: false,
  company_id: "",

  agent_id: "",
  description: "",
  contact_name: "",
  email: "",
  whatsapp: "",
  main_zone: "",
  zones: [],
  specialties: [],
  pax_capacity: "",
  unit_count: "",
  operating_limit: "",
  availability: "available",
  record_status: "active",
  notes: "",
  base_city: "",
  state: "",
  country: "",
  cities_served: [],
  destinations: [],
  tourist_zones: [],
  max_distance_km: "",
  requires_advance_booking: false,
  advance_notice_hours: "",
  transport_service_types: [],
  driver_first_name: "",
  driver_last_name: "",
  vehicle_brand: "",
  vehicle_model: "",
  vehicle_version: "",
  vehicle_year: "",
  vehicle_plate: "",
  vehicle_color: "",
  vehicle_type: "",
  vehicle_fuel: "",
  vehicle_transmission: "",
  luggage_capacity: "",
  large_luggage_capacity: "",
  cabin_luggage_capacity: "",
  is_accessible: false,
  has_air_conditioning: false,
  vehicle_notes: "",

};

export function resourceToInput(r: Resource): ResourceInput {
  return {
    name: r.name ?? "",
    kind: r.kind as CompanyKind,
    category: r.category as ResourceCategory,
    resource_class: (r.resource_class ?? "company") as ResourceClass,
    subtype: r.subtype ?? "",
    owner_type: (r.owner_type ?? "viae") as ResourceOwnerType,
    owner_company_id: r.owner_company_id ?? "",
    owner_name: r.owner_name ?? "",
    self_drive: r.self_drive ?? false,
    company_id: r.company_id ?? "",

    agent_id: r.agent_id ?? "",
    description: r.description ?? "",
    contact_name: r.contact_name ?? "",
    email: r.email ?? "",
    whatsapp: r.whatsapp ?? "",
    main_zone: r.main_zone ?? "",
    zones: r.zones ?? [],
    specialties: r.specialties ?? [],
    pax_capacity: r.pax_capacity != null ? String(r.pax_capacity) : "",
    unit_count: r.unit_count != null ? String(r.unit_count) : "",
    operating_limit: r.operating_limit != null ? String(r.operating_limit) : "",
    availability: r.availability as ResourceAvailability,
    record_status: r.record_status as RecordStatus,
    notes: r.notes ?? "",
    base_city: r.base_city ?? "",
    state: r.state ?? "",
    country: r.country ?? "",
    cities_served: r.cities_served ?? [],
    destinations: r.destinations ?? [],
    tourist_zones: r.tourist_zones ?? [],
    max_distance_km: r.max_distance_km != null ? String(r.max_distance_km) : "",
    requires_advance_booking: r.requires_advance_booking ?? false,
    advance_notice_hours: r.advance_notice_hours != null ? String(r.advance_notice_hours) : "",
    transport_service_types: (r.transport_service_types ?? []) as TransportServiceType[],
    driver_first_name: r.driver_first_name ?? "",
    driver_last_name: r.driver_last_name ?? "",
    vehicle_brand: r.vehicle_brand ?? "",
    vehicle_model: r.vehicle_model ?? "",
    vehicle_version: r.vehicle_version ?? "",
    vehicle_year: r.vehicle_year != null ? String(r.vehicle_year) : "",
    vehicle_plate: r.vehicle_plate ?? "",
    vehicle_color: r.vehicle_color ?? "",
    vehicle_type: (r.vehicle_type ?? "") as VehicleType | "",
    vehicle_fuel: r.vehicle_fuel ?? "",
    vehicle_transmission: r.vehicle_transmission ?? "",
    luggage_capacity: r.luggage_capacity != null ? String(r.luggage_capacity) : "",
    large_luggage_capacity:
      r.large_luggage_capacity != null ? String(r.large_luggage_capacity) : "",
    cabin_luggage_capacity:
      r.cabin_luggage_capacity != null ? String(r.cabin_luggage_capacity) : "",
    is_accessible: r.is_accessible ?? false,
    has_air_conditioning: r.has_air_conditioning ?? false,
    vehicle_notes: r.vehicle_notes ?? "",

  };
}

function resourcePayload(input: ResourceInput) {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    name: input.name.trim(),
    kind: input.kind,
    category: input.category,
    resource_class: input.resource_class,
    subtype: input.subtype || null,
    owner_type: input.owner_type,
    owner_company_id: input.owner_company_id || null,
    owner_name: text(input.owner_name),
    self_drive: input.self_drive,
    company_id: input.company_id || null,

    agent_id: input.agent_id || null,
    description: text(input.description),
    contact_name: text(input.contact_name),
    email: text(input.email),
    whatsapp: text(input.whatsapp),
    main_zone: text(input.main_zone),
    zones: input.zones,
    specialties: input.specialties,
    pax_capacity: num(input.pax_capacity),
    unit_count: num(input.unit_count),
    operating_limit: num(input.operating_limit),
    availability: input.availability,
    record_status: input.record_status,
    notes: text(input.notes),
    base_city: text(input.base_city),
    state: text(input.state),
    country: text(input.country),
    cities_served: input.cities_served,
    destinations: input.destinations,
    tourist_zones: input.tourist_zones,
    max_distance_km: num(input.max_distance_km),
    requires_advance_booking: input.requires_advance_booking,
    advance_notice_hours: num(input.advance_notice_hours),
    transport_service_types: input.transport_service_types,
    driver_first_name: text(input.driver_first_name),
    driver_last_name: text(input.driver_last_name),
    vehicle_brand: text(input.vehicle_brand),
    vehicle_model: text(input.vehicle_model),
    vehicle_version: text(input.vehicle_version),
    vehicle_year: num(input.vehicle_year),
    vehicle_plate: text(input.vehicle_plate),
    vehicle_color: text(input.vehicle_color),
    vehicle_type: input.vehicle_type || null,
    vehicle_fuel: input.vehicle_fuel || null,
    vehicle_transmission: input.vehicle_transmission || null,
    luggage_capacity: num(input.luggage_capacity),
    large_luggage_capacity: num(input.large_luggage_capacity),
    cabin_luggage_capacity: num(input.cabin_luggage_capacity),
    is_accessible: input.is_accessible,
    has_air_conditioning: input.has_air_conditioning,
    vehicle_notes: text(input.vehicle_notes),
  };
}


export type ResourceFilters = {
  search?: string;
  kind?: CompanyKind | "all";
  category?: ResourceCategory | "all";
  availability?: ResourceAvailability | "all";
  zone?: string;
  includeArchived?: boolean;
  /** Filtros del catálogo inteligente (v1.8.2). */
  resourceClass?: ResourceClass | "all";
  subtype?: string;
  state?: string;
  city?: string;
  brand?: string;
  minCapacity?: string;
  companyId?: string;
  /** Modo rent a car: solo vehículos sin conductor. */
  selfDrive?: boolean;

};

export async function listResources(filters: ResourceFilters = {}): Promise<Resource[]> {
  let q = supabase.from("resources").select("*").order("name", { ascending: true });
  if (!filters.includeArchived) q = q.eq("record_status", "active");
  if (filters.kind && filters.kind !== "all") q = q.eq("kind", filters.kind);
  if (filters.category && filters.category !== "all") q = q.eq("category", filters.category);
  if (filters.availability && filters.availability !== "all")
    q = q.eq("availability", filters.availability);
  if (filters.resourceClass && filters.resourceClass !== "all")
    q = q.eq("resource_class", filters.resourceClass);
  if (filters.subtype && filters.subtype !== "all") q = q.eq("subtype", filters.subtype);
  if (filters.state && filters.state !== "all") q = q.eq("state", filters.state);
  if (filters.companyId && filters.companyId !== "all") q = q.eq("company_id", filters.companyId);
  if (filters.selfDrive) q = q.eq("self_drive", true);
  const { data, error } = await q;

  if (error) throw error;
  let rows = (data ?? []) as Resource[];

  const zone = filters.zone?.trim();
  if (zone && zone !== "all") {
    rows = rows.filter(
      (r) =>
        r.main_zone === zone ||
        (r.zones ?? []).includes(zone) ||
        (r.tourist_zones ?? []).includes(zone),
    );
  }
  const city = filters.city?.trim();
  if (city && city !== "all") {
    rows = rows.filter((r) => r.base_city === city || (r.cities_served ?? []).includes(city));
  }
  const brand = filters.brand?.trim().toLowerCase();
  if (brand) {
    rows = rows.filter((r) => (r.vehicle_brand ?? "").toLowerCase().includes(brand));
  }
  const minCapacity = filters.minCapacity?.trim();
  if (minCapacity && Number(minCapacity) > 0) {
    rows = rows.filter((r) => (r.pax_capacity ?? 0) >= Number(minCapacity));
  }

  const term = filters.search?.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) =>
    [
      r.name,
      r.description,
      r.contact_name,
      r.main_zone,
      r.base_city,
      r.state,
      r.vehicle_brand,
      r.vehicle_model,
      r.vehicle_plate,
      ...(r.zones ?? []),
      ...(r.specialties ?? []),
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term)),
  );

}

export async function getResource(id: string): Promise<Resource | null> {
  const { data, error } = await supabase.from("resources").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Resource) ?? null;
}

export async function createResource(input: ResourceInput): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { data, error } = await supabase
    .from("resources")
    .insert({ ...resourcePayload(input), user_id: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateResource(id: string, input: ResourceInput) {
  const { error } = await supabase.from("resources").update(resourcePayload(input)).eq("id", id);
  if (error) throw error;
}

/** Los recursos nunca se eliminan: cambian de estado. */
export async function setResourceStatus(id: string, record_status: RecordStatus) {
  const { error } = await supabase.from("resources").update({ record_status }).eq("id", id);
  if (error) throw error;
}

export async function setResourceAvailability(id: string, availability: ResourceAvailability) {
  const { error } = await supabase.from("resources").update({ availability }).eq("id", id);
  if (error) throw error;
}

// -------------------------------------------------- relación con las reservas

export async function listBookingResources(bookingId: string): Promise<BookingResource[]> {
  const { data, error } = await supabase
    .from("booking_resources")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("record_status", "active")
    .order("assigned_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookingResource[];
}

export async function listResourceBookings(resourceId: string): Promise<BookingResource[]> {
  const { data, error } = await supabase
    .from("booking_resources")
    .select("*")
    .eq("resource_id", resourceId)
    .eq("record_status", "active")
    .order("assigned_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BookingResource[];
}

export async function assignResourceToBooking(
  bookingId: string,
  resourceId: string,
  notes?: string,
) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { error } = await supabase.from("booking_resources").insert({
    booking_id: bookingId,
    resource_id: resourceId,
    user_id: uid,
    assigned_by: uid,
    notes: notes?.trim() || null,
  });
  if (error) throw error;
}

/** La asignación no se elimina: se archiva para conservar el historial. */
export async function unassignResource(id: string) {
  const { error } = await supabase
    .from("booking_resources")
    .update({ record_status: "archived" })
    .eq("id", id);
  if (error) throw error;
}

// ----------------------------------------------------------- estadísticas

export type ResourceStats = {
  total: number;
  internal: number;
  external: number;
  available: number;
  unavailable: number;
  byCategory: { category: ResourceCategory; label: string; count: number }[];
  /** Catálogo inteligente (v1.8.2). */
  vehiclesAvailable: number;
  driversAvailable: number;
  byState: { state: string; count: number }[];
};

function isVehicleRow(r: Resource) {
  return r.resource_class === "vehicle" || r.category === "vehicle";
}

function isDriverRow(r: Resource) {
  return (
    (r.resource_class === "person" && (r.subtype === "driver" || r.category === "driver")) ||
    r.category === "driver"
  );
}

export function computeResourceStats(resources: Resource[]): ResourceStats {
  const byCategory = RESOURCE_CATEGORIES.map((c) => ({
    category: c.value,
    label: c.label,
    count: resources.filter((r) => r.category === c.value).length,
  })).filter((c) => c.count > 0);

  const stateCounts = new Map<string, number>();
  for (const r of resources) {
    const key = r.state?.trim() || "Sin definir";
    stateCounts.set(key, (stateCounts.get(key) ?? 0) + 1);
  }

  return {
    total: resources.length,
    internal: resources.filter((r) => r.kind === "internal").length,
    external: resources.filter((r) => r.kind === "external").length,
    available: resources.filter((r) => r.availability === "available").length,
    unavailable: resources.filter(
      (r) => r.availability === "unavailable" || r.availability === "out_of_service",
    ).length,
    byCategory,
    vehiclesAvailable: resources.filter((r) => isVehicleRow(r) && r.availability === "available")
      .length,
    driversAvailable: resources.filter((r) => isDriverRow(r) && r.availability === "available")
      .length,
    byState: Array.from(stateCounts.entries())
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count),
  };

}
