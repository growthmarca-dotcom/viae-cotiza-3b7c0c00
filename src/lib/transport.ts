import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Resource, ResourceAvailability } from "@/lib/resources";

/**
 * Red de transporte turístico distribuida (v1.1).
 *
 * No es un módulo independiente: los taxis, transfers, choferes y vehículos
 * son recursos especializados del módulo Recursos Operativos. Aquí vive la
 * lógica propia del transporte: tipos de servicio, servicios de una reserva,
 * historial de estados y las utilidades de búsqueda de candidatos que en el
 * futuro alimentarán el motor de asignación automática.
 */

export type TransportService = Tables<"transport_services">;
export type TransportServiceEvent = Tables<"transport_service_history">;
export type ResourceAvailabilityEvent = Tables<"resource_availability_log">;

export type TransportServiceType =
  | "taxi"
  | "airport_transfer"
  | "tourist_transfer"
  | "intercity_transfer"
  | "private_transfer"
  | "corporate_transfer"
  | "group_transfer"
  | "driver_excursion"
  | "other";

export type TransportServiceStatus =
  | "pending"
  | "requested"
  | "assigned"
  | "accepted"
  | "rejected"
  | "en_route"
  | "at_origin"
  | "in_transit"
  | "completed"
  | "cancelled";

/** Modalidad de pago del pasajero (v1.2). */
export type TransportPaymentMode = "prepaid_viae" | "direct_to_driver" | "partial" | "pending";

/** Estado del cobro al pasajero (v1.2). */
export type TransportCollectionStatus = "not_applicable" | "pending" | "collected" | "reported";

export type VehicleType =
  | "sedan"
  | "suv"
  | "van"
  | "minibus"
  | "bus"
  | "pickup"
  | "motorcycle"
  | "accessible"
  | "other";

export const TRANSPORT_SERVICE_TYPES: { value: TransportServiceType; label: string }[] = [
  { value: "taxi", label: "Taxi" },
  { value: "airport_transfer", label: "Transfer aeropuerto" },
  { value: "tourist_transfer", label: "Traslado turístico" },
  { value: "intercity_transfer", label: "Traslado interurbano" },
  { value: "private_transfer", label: "Traslado privado" },
  { value: "corporate_transfer", label: "Traslado corporativo" },
  { value: "group_transfer", label: "Traslado grupal" },
  { value: "driver_excursion", label: "Excursión con chofer" },
  { value: "other", label: "Otro" },
];

export const TRANSPORT_SERVICE_STATUSES: { value: TransportServiceStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "requested", label: "Solicitado" },
  { value: "assigned", label: "Asignado" },
  { value: "accepted", label: "Aceptado" },
  { value: "rejected", label: "Rechazado" },
  { value: "en_route", label: "En camino al pasajero" },
  { value: "at_origin", label: "En origen" },
  { value: "in_transit", label: "En traslado" },
  { value: "completed", label: "Finalizado" },
  { value: "cancelled", label: "Cancelado" },
];

export const TRANSPORT_PAYMENT_MODES: { value: TransportPaymentMode; label: string }[] = [
  { value: "prepaid_viae", label: "Prepagado por ViaE" },
  { value: "direct_to_driver", label: "Pago directo al conductor" },
  { value: "partial", label: "Pago parcial" },
  { value: "pending", label: "Pago pendiente" },
];

export const TRANSPORT_COLLECTION_STATUSES: {
  value: TransportCollectionStatus;
  label: string;
}[] = [
  { value: "not_applicable", label: "No corresponde cobrar" },
  { value: "pending", label: "Pendiente de cobro" },
  { value: "collected", label: "Cobrado" },
  { value: "reported", label: "Informado" },
];

export function paymentModeLabel(value: string | null) {
  if (!value) return "—";
  return TRANSPORT_PAYMENT_MODES.find((m) => m.value === value)?.label ?? value;
}

export function collectionStatusLabel(value: string | null) {
  if (!value) return "—";
  return TRANSPORT_COLLECTION_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function collectionStatusClasses(value: string | null) {
  switch (value) {
    case "collected":
    case "reported":
      return "bg-primary/10 text-primary border-primary/30";
    case "pending":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: "sedan", label: "Auto sedán" },
  { value: "suv", label: "SUV / 4x4" },
  { value: "van", label: "Van / combi" },
  { value: "minibus", label: "Minibús" },
  { value: "bus", label: "Bus" },
  { value: "pickup", label: "Pick-up" },
  { value: "motorcycle", label: "Moto" },
  { value: "accessible", label: "Adaptado / accesible" },
  { value: "other", label: "Otro" },
];

export function serviceTypeLabel(value: string) {
  return TRANSPORT_SERVICE_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function serviceStatusLabel(value: string) {
  return TRANSPORT_SERVICE_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function vehicleTypeLabel(value: string | null) {
  if (!value) return "—";
  return VEHICLE_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function serviceStatusClasses(value: string) {
  switch (value) {
    case "accepted":
    case "completed":
      return "bg-primary/10 text-primary border-primary/30";
    case "cancelled":
    case "rejected":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "assigned":
    case "en_route":
    case "at_origin":
    case "in_transit":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

// ----------------------------------------------- recursos de la red

/** Categorías de recursos que forman la red de transporte. */
export const DRIVER_CATEGORIES = ["driver"] as const;
export const VEHICLE_CATEGORIES = ["vehicle"] as const;
export const TRANSPORT_CATEGORIES = ["driver", "vehicle", "taxi", "transfer"] as const;

export function isDriverResource(r: Resource) {
  return r.category === "driver";
}

export function isVehicleResource(r: Resource) {
  return r.category === "vehicle";
}

export function isTransportResource(r: Resource) {
  return (TRANSPORT_CATEGORIES as readonly string[]).includes(r.category);
}

export function driverFullName(r: Resource) {
  const name = [r.driver_first_name, r.driver_last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : r.name;
}

export function vehicleDescription(r: Resource) {
  return (
    [r.vehicle_brand, r.vehicle_model, r.vehicle_year].filter(Boolean).join(" ").trim() || r.name
  );
}

/** Ciudades y destinos donde el recurso puede operar. */
export function coverageOf(r: Resource): string[] {
  return Array.from(
    new Set(
      [r.base_city, ...(r.cities_served ?? []), ...(r.destinations ?? []), ...(r.zones ?? []), r.main_zone]
        .filter(Boolean)
        .map((v) => String(v)),
    ),
  );
}

/**
 * Criterios del futuro motor de asignación. Hoy sólo filtran y ordenan
 * candidatos para que un humano elija; NO asignan automáticamente.
 */
export type AssignmentCriteria = {
  origin?: string | null;
  destination?: string | null;
  serviceType?: TransportServiceType | null;
  paxCount?: number | null;
  luggageCount?: number | null;
  onlyAvailable?: boolean;
};

function matchesPlace(r: Resource, place?: string | null) {
  if (!place || place.trim() === "") return true;
  const term = place.trim().toLowerCase();
  return coverageOf(r).some((c) => c.toLowerCase().includes(term) || term.includes(c.toLowerCase()));
}

/** Sugerencias de recursos según los criterios. Devuelve candidatos, no decisiones. */
export function suggestTransportResources(
  resources: Resource[],
  criteria: AssignmentCriteria = {},
): Resource[] {
  return resources.filter((r) => {
    if (!isTransportResource(r)) return false;
    if (r.record_status !== "active") return false;
    if (criteria.onlyAvailable && r.availability !== "available") return false;
    if (criteria.paxCount && r.pax_capacity != null && r.pax_capacity < criteria.paxCount)
      return false;
    if (
      criteria.luggageCount &&
      r.luggage_capacity != null &&
      r.luggage_capacity < criteria.luggageCount
    )
      return false;
    if (
      criteria.serviceType &&
      (r.transport_service_types ?? []).length > 0 &&
      !(r.transport_service_types ?? []).includes(criteria.serviceType)
    )
      return false;
    if (!matchesPlace(r, criteria.origin)) return false;
    if (!matchesPlace(r, criteria.destination)) return false;
    return true;
  });
}

// ------------------------------------------------------- disponibilidad

export async function listAvailabilityLog(
  resourceId: string,
): Promise<ResourceAvailabilityEvent[]> {
  const { data, error } = await supabase
    .from("resource_availability_log")
    .select("*")
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ResourceAvailabilityEvent[];
}

/** Atajo "ESTOY DISPONIBLE": el trigger de la base registra el cambio. */
export async function markResourceAvailable(resourceId: string) {
  const { error } = await supabase
    .from("resources")
    .update({ availability: "available" as ResourceAvailability })
    .eq("id", resourceId);
  if (error) throw error;
}

// -------------------------------------------------- servicios de transporte

export type TransportServiceInput = {
  service_type: TransportServiceType;
  status: TransportServiceStatus;
  origin: string;
  destination: string;
  service_date: string;
  service_time: string;
  pax_count: string;
  luggage_count: string;
  driver_resource_id: string;
  vehicle_resource_id: string;
  company_id: string;
  notes: string;
};

export const EMPTY_TRANSPORT_SERVICE: TransportServiceInput = {
  service_type: "airport_transfer",
  status: "pending",
  origin: "",
  destination: "",
  service_date: "",
  service_time: "",
  pax_count: "",
  luggage_count: "",
  driver_resource_id: "",
  vehicle_resource_id: "",
  company_id: "",
  notes: "",
};

export function serviceToInput(s: TransportService): TransportServiceInput {
  return {
    service_type: s.service_type as TransportServiceType,
    status: s.status as TransportServiceStatus,
    origin: s.origin ?? "",
    destination: s.destination ?? "",
    service_date: s.service_date ?? "",
    service_time: s.service_time ? String(s.service_time).slice(0, 5) : "",
    pax_count: s.pax_count != null ? String(s.pax_count) : "",
    luggage_count: s.luggage_count != null ? String(s.luggage_count) : "",
    driver_resource_id: s.driver_resource_id ?? "",
    vehicle_resource_id: s.vehicle_resource_id ?? "",
    company_id: s.company_id ?? "",
    notes: s.notes ?? "",
  };
}

function servicePayload(input: TransportServiceInput) {
  const text = (v: string) => (v.trim() === "" ? null : v.trim());
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    service_type: input.service_type,
    status: input.status,
    origin: text(input.origin),
    destination: text(input.destination),
    service_date: text(input.service_date),
    service_time: text(input.service_time),
    pax_count: num(input.pax_count),
    luggage_count: num(input.luggage_count),
    driver_resource_id: input.driver_resource_id || null,
    vehicle_resource_id: input.vehicle_resource_id || null,
    company_id: input.company_id || null,
    notes: text(input.notes),
  };
}

export type TransportFilters = {
  search?: string;
  status?: TransportServiceStatus | "all";
  serviceType?: TransportServiceType | "all";
  date?: string;
  includeArchived?: boolean;
};

export async function listTransportServices(
  filters: TransportFilters = {},
): Promise<TransportService[]> {
  let q = supabase
    .from("transport_services")
    .select("*")
    .order("service_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (!filters.includeArchived) q = q.eq("record_status", "active");
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.serviceType && filters.serviceType !== "all")
    q = q.eq("service_type", filters.serviceType);
  if (filters.date) q = q.eq("service_date", filters.date);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as TransportService[];
  const term = filters.search?.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((s) =>
    [s.origin, s.destination, s.notes]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term)),
  );
}

export async function listBookingTransportServices(
  bookingId: string,
): Promise<TransportService[]> {
  const { data, error } = await supabase
    .from("transport_services")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("record_status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TransportService[];
}

export async function createTransportService(
  bookingId: string | null,
  input: TransportServiceInput,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const payload = servicePayload(input);
  const { data, error } = await supabase
    .from("transport_services")
    .insert({
      ...payload,
      booking_id: bookingId,
      user_id: uid,
      assigned_by: payload.driver_resource_id || payload.vehicle_resource_id ? uid : null,
      assigned_at:
        payload.driver_resource_id || payload.vehicle_resource_id
          ? new Date().toISOString()
          : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateTransportService(id: string, input: TransportServiceInput) {
  const { error } = await supabase
    .from("transport_services")
    .update(servicePayload(input))
    .eq("id", id);
  if (error) throw error;
}

export async function setTransportServiceStatus(id: string, status: TransportServiceStatus) {
  const { error } = await supabase.from("transport_services").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Los servicios no se eliminan: se archivan para conservar el historial. */
export async function archiveTransportService(id: string, archived = true) {
  const { error } = await supabase
    .from("transport_services")
    .update({ record_status: archived ? "archived" : "active" })
    .eq("id", id);
  if (error) throw error;
}

export async function listTransportServiceHistory(
  serviceId: string,
): Promise<TransportServiceEvent[]> {
  const { data, error } = await supabase
    .from("transport_service_history")
    .select("*")
    .eq("service_id", serviceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TransportServiceEvent[];
}

// -------------------------------------------------------------- métricas

export type TransportStats = {
  drivers: number;
  driversAvailable: number;
  driversBusy: number;
  vehicles: number;
  vehiclesAvailable: number;
  pendingServices: number;
  assignedServices: number;
};

export function computeTransportStats(
  resources: Resource[],
  services: TransportService[],
): TransportStats {
  const drivers = resources.filter(isDriverResource);
  const vehicles = resources.filter(isVehicleResource);
  return {
    drivers: drivers.length,
    driversAvailable: drivers.filter((d) => d.availability === "available").length,
    driversBusy: drivers.filter((d) => d.availability === "busy").length,
    vehicles: vehicles.length,
    vehiclesAvailable: vehicles.filter((v) => v.availability === "available").length,
    pendingServices: services.filter((s) => s.status === "pending" || s.status === "requested")
      .length,
    assignedServices: services.filter(
      (s) => s.status === "assigned" || s.status === "accepted" || s.status === "in_transit",
    ).length,
  };
}
