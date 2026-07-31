import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Central operativa de reservas (v1.8).
 *
 * Separación de roles: el AGENTE vende (estado comercial de la reserva) y la
 * CENTRAL opera (estado operativo, servicios, proveedores y recursos).
 * El estado operativo es independiente del estado comercial existente.
 */

export type BookingService = Tables<"booking_services">;

export type OperationStatus =
  | "pending_operation"
  | "preparing"
  | "services_coordinated"
  | "ready"
  | "in_execution"
  | "finished"
  | "incident"
  | "cancelled";

export const OPERATION_STATUSES: { value: OperationStatus; label: string }[] = [
  { value: "pending_operation", label: "Pendiente de operación" },
  { value: "preparing", label: "En preparación" },
  { value: "services_coordinated", label: "Servicios coordinados" },
  { value: "ready", label: "Listo para viaje" },
  { value: "in_execution", label: "En ejecución" },
  { value: "finished", label: "Finalizado" },
  { value: "incident", label: "Incidencia" },
  { value: "cancelled", label: "Cancelado" },
];

export function operationStatusLabel(value: string | null) {
  return OPERATION_STATUSES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export function operationStatusClasses(value: string | null) {
  switch (value) {
    case "incident":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "ready":
    case "services_coordinated":
      return "bg-primary/10 text-primary border-primary/30";
    case "in_execution":
      return "bg-gold/15 text-foreground border-gold/40";
    case "finished":
      return "bg-secondary text-secondary-foreground border-border";
    case "cancelled":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Estados en los que la reserva todavía requiere trabajo de la central. */
export const OPEN_OPERATION_STATUSES: OperationStatus[] = [
  "pending_operation",
  "preparing",
  "services_coordinated",
  "ready",
  "in_execution",
  "incident",
];

// ------------------------------------------------------------------ servicios

export type ServiceKind =
  | "accommodation"
  | "transfer"
  | "excursion"
  | "car_rental"
  | "flight"
  | "insurance"
  | "gastronomy"
  | "other";

export const SERVICE_KINDS: { value: ServiceKind; label: string }[] = [
  { value: "accommodation", label: "Alojamiento" },
  { value: "transfer", label: "Traslado" },
  { value: "excursion", label: "Excursión" },
  { value: "car_rental", label: "Alquiler de auto" },
  { value: "flight", label: "Vuelo" },
  { value: "insurance", label: "Seguro" },
  { value: "gastronomy", label: "Gastronomía / experiencias" },
  { value: "other", label: "Otros" },
];

export function serviceKindLabel(value: string | null) {
  return SERVICE_KINDS.find((k) => k.value === value)?.label ?? value ?? "—";
}

export type BookingServiceInput = {
  kind: ServiceKind;
  title: string;
  status: OperationStatus;
  responsible_user_id: string | null;
  resource_id: string | null;
  company_id: string | null;
  provider_name: string | null;
  service_date: string | null;
  notes: string | null;
};

export const EMPTY_SERVICE: BookingServiceInput = {
  kind: "other",
  title: "",
  status: "pending_operation",
  responsible_user_id: null,
  resource_id: null,
  company_id: null,
  provider_name: null,
  service_date: null,
  notes: null,
};

export async function listBookingServices(bookingId: string): Promise<BookingService[]> {
  const { data, error } = await supabase
    .from("booking_services")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("record_status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookingService[];
}

/** Servicios de todas las reservas visibles (para la bandeja operativa). */
export async function listAllBookingServices(): Promise<BookingService[]> {
  const { data, error } = await supabase
    .from("booking_services")
    .select("*")
    .eq("record_status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BookingService[];
}

export async function createBookingService(bookingId: string, input: BookingServiceInput) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { error } = await supabase.from("booking_services").insert({
    booking_id: bookingId,
    user_id: uid,
    ...input,
    title: input.title.trim() || serviceKindLabel(input.kind),
  });
  if (error) throw error;
}

export async function updateBookingService(id: string, input: Partial<BookingServiceInput>) {
  const { error } = await supabase.from("booking_services").update(input).eq("id", id);
  if (error) throw error;
}

/** Los servicios no se eliminan: se archivan. */
export async function archiveBookingService(id: string) {
  const { error } = await supabase
    .from("booking_services")
    .update({ record_status: "archived" })
    .eq("id", id);
  if (error) throw error;
}

// -------------------------------------------------------------- reserva (ops)

export async function setOperationStatus(bookingId: string, status: OperationStatus) {
  const { error } = await supabase
    .from("bookings")
    .update({ operation_status: status })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function setOperationsOwner(bookingId: string, userId: string | null) {
  const { error } = await supabase
    .from("bookings")
    .update({ operations_owner_id: userId })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function setOperationsNotes(bookingId: string, notes: string | null) {
  const { error } = await supabase
    .from("bookings")
    .update({ operations_notes: notes })
    .eq("id", bookingId);
  if (error) throw error;
}

// ------------------------------------------------------- usuarios internos

export type InternalUser = { id: string; name: string; roles: string[] };

/**
 * Directorio de usuarios internos habilitados para tomar reservas.
 * Hoy: administradores y rol Operaciones. Preparado para más perfiles internos.
 */
export async function listInternalUsers(): Promise<InternalUser[]> {
  const [{ data: roles, error: rolesError }, { data: profiles }] = await Promise.all([
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  if (rolesError) throw rolesError;

  const byUser = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(String(r.role));
    byUser.set(r.user_id, list);
  }

  return (profiles ?? [])
    .map((p) => ({
      id: p.id,
      name: p.full_name?.trim() || "Usuario interno",
      roles: byUser.get(p.id) ?? [],
    }))
    .filter((u) => u.roles.some((r) => r === "admin" || r === "operations"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ------------------------------------------------------------- estadísticas

export type OperationsStats = {
  pending: number;
  upcoming: number;
  unassignedServices: number;
  incidents: number;
  finishedServices: number;
};

export function computeOperationsStats(
  bookings: { operation_status: string; travel_start: string | null }[],
  services: { status: string; resource_id: string | null; company_id: string | null; provider_name: string | null }[],
): OperationsStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    pending: bookings.filter((b) => b.operation_status === "pending_operation").length,
    upcoming: bookings.filter((b) => {
      if (!b.travel_start) return false;
      if (b.operation_status === "cancelled" || b.operation_status === "finished") return false;
      const d = new Date(`${b.travel_start}T00:00:00`);
      return d >= today && d <= in7;
    }).length,
    unassignedServices: services.filter(
      (s) =>
        s.status !== "cancelled" &&
        s.status !== "finished" &&
        !s.resource_id &&
        !s.company_id &&
        !s.provider_name,
    ).length,
    incidents: bookings.filter((b) => b.operation_status === "incident").length,
    finishedServices: services.filter((s) => s.status === "finished").length,
  };
}
