import { supabase } from "@/integrations/supabase/client";
import type { Resource, ResourceAvailability } from "@/lib/resources";
import type {
  TransportService,
  TransportServiceEvent,
  TransportServiceStatus,
} from "@/lib/transport";

/**
 * Panel operativo del conductor (v1.2).
 *
 * El conductor es un recurso del módulo Recursos Operativos vinculado a un
 * usuario del sistema (directamente por `driver_user_id` o a través de su
 * ficha de agente). Acá vive únicamente la lógica de SU operación diaria:
 * sus servicios, el flujo del viaje, su disponibilidad y el cobro al
 * pasajero. Sin GPS, sin liquidaciones y sin comisiones (v1.3+).
 */

export type DriverServiceGroup = "upcoming" | "active" | "finished" | "cancelled";

export const REJECTION_REASONS = [
  "No disponible",
  "Problema vehículo",
  "Otro",
] as const;

export type DriverServiceContext = {
  service_id: string;
  booking_number: string | null;
  client_name: string | null;
};

/** Recursos de conducción del usuario actual (según RLS y el vínculo cargado). */
export async function listMyDriverResources(): Promise<Resource[]> {
  const { data: ids, error: idsError } = await supabase.rpc("current_driver_resource_ids");
  if (idsError) throw idsError;
  const list = (ids ?? []) as unknown as string[];
  if (list.length === 0) return [];
  const { data, error } = await supabase.from("resources").select("*").in("id", list);
  if (error) throw error;
  return (data ?? []) as Resource[];
}

/** Servicios asignados al conductor actual. */
export async function listMyDriverServices(resourceIds: string[]): Promise<TransportService[]> {
  if (resourceIds.length === 0) return [];
  const { data, error } = await supabase
    .from("transport_services")
    .select("*")
    .in("driver_resource_id", resourceIds)
    .eq("record_status", "active")
    .order("service_date", { ascending: true, nullsFirst: false })
    .order("service_time", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as TransportService[];
}

/** Datos mínimos y seguros de la reserva (número y cliente) para el conductor. */
export async function listMyServiceContext(): Promise<Map<string, DriverServiceContext>> {
  const { data, error } = await supabase.rpc("driver_service_context");
  if (error) throw error;
  const rows = (data ?? []) as DriverServiceContext[];
  return new Map(rows.map((r) => [r.service_id, r]));
}

export function groupOfService(s: TransportService): DriverServiceGroup {
  switch (s.status) {
    case "en_route":
    case "at_origin":
    case "in_transit":
      return "active";
    case "completed":
      return "finished";
    case "cancelled":
    case "rejected":
      return "cancelled";
    default:
      return "upcoming";
  }
}

export function groupServices(services: TransportService[]) {
  const groups: Record<DriverServiceGroup, TransportService[]> = {
    upcoming: [],
    active: [],
    finished: [],
    cancelled: [],
  };
  for (const s of services) groups[groupOfService(s)].push(s);
  return groups;
}

// ------------------------------------------------------ flujo operativo

async function patchService(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("transport_services").update(patch).eq("id", id);
  if (error) throw error;
}

const now = () => new Date().toISOString();

/** Asignado → Aceptado (registra fecha y hora). */
export async function acceptService(id: string) {
  await patchService(id, { status: "accepted" as TransportServiceStatus, accepted_at: now() });
}

/** Asignado → Rechazado con motivo. */
export async function rejectService(id: string, reason: string) {
  await patchService(id, {
    status: "rejected" as TransportServiceStatus,
    rejected_at: now(),
    rejection_reason: reason,
  });
}

/** Inicia el viaje: en camino al pasajero. */
export async function startService(id: string) {
  await patchService(id, { status: "en_route" as TransportServiceStatus, started_at: now() });
}

/** Llegada al punto de recogida. */
export async function arriveAtOrigin(id: string) {
  await patchService(id, { status: "at_origin" as TransportServiceStatus, arrived_at: now() });
}

/** Pasajero a bordo: en traslado. */
export async function passengerOnboard(id: string) {
  await patchService(id, { status: "in_transit" as TransportServiceStatus, onboard_at: now() });
}

/** Finaliza el viaje. */
export async function completeService(id: string) {
  await patchService(id, { status: "completed" as TransportServiceStatus, completed_at: now() });
}

/** Confirmación de cobro recibido: fecha, hora, usuario y monto informado. */
export async function confirmCollection(id: string, amount: number | null) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  await patchService(id, {
    collection_status: "collected",
    collected_at: now(),
    collected_by: uid,
    collected_amount: amount,
  });
}

/** Acciones disponibles según el estado actual del servicio. */
export function nextDriverActions(status: string): {
  key: "accept" | "reject" | "start" | "arrive" | "onboard" | "complete";
  label: string;
}[] {
  switch (status) {
    case "pending":
    case "requested":
    case "assigned":
      return [
        { key: "accept", label: "Aceptar viaje" },
        { key: "reject", label: "Rechazar viaje" },
      ];
    case "accepted":
      return [{ key: "start", label: "Iniciar viaje" }];
    case "en_route":
      return [{ key: "arrive", label: "Llegué al punto de recogida" }];
    case "at_origin":
      return [{ key: "onboard", label: "Pasajero a bordo" }];
    case "in_transit":
      return [{ key: "complete", label: "Finalizar viaje" }];
    default:
      return [];
  }
}

// ------------------------------------------------------ disponibilidad

/**
 * La disponibilidad se sincroniza automáticamente en la base cuando cambia el
 * estado de un servicio (En viaje / Disponible). Este atajo permite al
 * conductor informarla manualmente.
 */
export async function setMyAvailability(resourceId: string, availability: ResourceAvailability) {
  const { error } = await supabase
    .from("resources")
    .update({ availability })
    .eq("id", resourceId);
  if (error) throw error;
}

// ------------------------------------------------------ historial

export async function listServiceHistory(serviceId: string): Promise<TransportServiceEvent[]> {
  const { data, error } = await supabase
    .from("transport_service_history")
    .select("*")
    .eq("service_id", serviceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TransportServiceEvent[];
}

export function lastUpdateOf(s: TransportService): string | null {
  const stamps = [
    s.completed_at,
    s.onboard_at,
    s.arrived_at,
    s.started_at,
    s.rejected_at,
    s.accepted_at,
    s.collected_at,
    s.updated_at,
  ].filter(Boolean) as string[];
  if (stamps.length === 0) return null;
  return stamps.sort().at(-1) ?? null;
}
