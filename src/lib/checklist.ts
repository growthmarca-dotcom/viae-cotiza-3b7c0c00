import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Checklist operativo y centro de incidencias (v1.8.1).
 *
 * El checklist se crea automáticamente al dar de alta la reserva (trigger en
 * base de datos) con un catálogo base pensado para volverse configurable.
 * Los ítems críticos generan advertencias visuales, nunca bloqueos.
 */

export type ChecklistItem = Tables<"booking_checklist_items">;
export type Incident = Tables<"booking_incidents">;

export type ChecklistStatus = "pending" | "in_progress" | "done" | "not_applicable";

export const CHECKLIST_STATUSES: { value: ChecklistStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En proceso" },
  { value: "done", label: "Completado" },
  { value: "not_applicable", label: "No aplica" },
];

export function checklistStatusLabel(value: string | null) {
  return CHECKLIST_STATUSES.find((s) => s.value === value)?.label ?? "Pendiente";
}

export function checklistStatusClasses(value: string | null) {
  switch (value) {
    case "done":
      return "bg-primary/10 text-primary border-primary/30";
    case "in_progress":
      return "bg-gold/15 text-foreground border-gold/40";
    case "not_applicable":
      return "bg-secondary text-muted-foreground border-border";
    default:
      return "bg-destructive/10 text-destructive border-destructive/30";
  }
}

/** Advertencias por tarea crítica pendiente (código → texto para la central). */
const CRITICAL_WARNING: Record<string, string> = {
  payment_confirmed: "Pago pendiente.",
  hotel_confirmed: "Hotel sin confirmar.",
  transfer_confirmed: "Traslado sin confirmar.",
  driver_assigned: "Chofer no asignado.",
  documentation_sent: "Documentación pendiente.",
};

export type ChecklistProgress = {
  total: number;
  done: number;
  /** 0-100. Las tareas "no aplica" se excluyen del denominador. */
  percent: number;
  warnings: string[];
};

export function computeChecklistProgress(items: ChecklistItem[]): ChecklistProgress {
  const applicable = items.filter((i) => i.status !== "not_applicable");
  const done = applicable.filter((i) => i.status === "done").length;
  const total = applicable.length;
  const warnings = items
    .filter((i) => i.is_critical && i.status !== "done" && i.status !== "not_applicable")
    .map((i) => CRITICAL_WARNING[i.code] ?? `${i.label}: pendiente.`);

  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    warnings,
  };
}

export async function listChecklistItems(bookingId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("booking_checklist_items")
    .select("*")
    .eq("booking_id", bookingId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Checklist de varias reservas, agrupado por reserva (listados y dashboard). */
export async function listChecklistByBooking(
  bookingIds?: string[],
): Promise<Map<string, ChecklistItem[]>> {
  let q = supabase.from("booking_checklist_items").select("*");
  if (bookingIds) {
    if (bookingIds.length === 0) return new Map();
    q = q.in("booking_id", bookingIds);
  }
  const { data, error } = await q;
  if (error) throw error;

  const map = new Map<string, ChecklistItem[]>();
  for (const item of data ?? []) {
    const list = map.get(item.booking_id) ?? [];
    list.push(item);
    map.set(item.booking_id, list);
  }
  return map;
}

export async function updateChecklistItem(
  id: string,
  patch: { status?: ChecklistStatus; notes?: string | null },
) {
  const { error } = await supabase.from("booking_checklist_items").update(patch).eq("id", id);
  if (error) throw error;
}

// ===================== Incidencias =====================

export type IncidentCategory =
  | "flight"
  | "hotel"
  | "transfer"
  | "excursion"
  | "vehicle"
  | "driver"
  | "client"
  | "payment"
  | "documentation"
  | "provider"
  | "other";

export const INCIDENT_CATEGORIES: { value: IncidentCategory; label: string }[] = [
  { value: "flight", label: "Vuelo" },
  { value: "hotel", label: "Hotel" },
  { value: "transfer", label: "Traslado" },
  { value: "excursion", label: "Excursión" },
  { value: "vehicle", label: "Vehículo" },
  { value: "driver", label: "Chofer" },
  { value: "client", label: "Cliente" },
  { value: "payment", label: "Pago" },
  { value: "documentation", label: "Documentación" },
  { value: "provider", label: "Proveedor" },
  { value: "other", label: "Otro" },
];

export function incidentCategoryLabel(value: string | null) {
  return INCIDENT_CATEGORIES.find((c) => c.value === value)?.label ?? "Otro";
}

export type IncidentPriority = "low" | "medium" | "high" | "urgent";

export const INCIDENT_PRIORITIES: { value: IncidentPriority; label: string }[] = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function incidentPriorityLabel(value: string | null) {
  return INCIDENT_PRIORITIES.find((p) => p.value === value)?.label ?? "Media";
}

export function incidentPriorityClasses(value: string | null) {
  switch (value) {
    case "urgent":
      return "bg-destructive/15 text-destructive border-destructive/40";
    case "high":
      return "bg-gold/15 text-foreground border-gold/40";
    case "low":
      return "bg-secondary text-muted-foreground border-border";
    default:
      return "bg-primary/10 text-primary border-primary/30";
  }
}

export type IncidentStatus = "open" | "in_review" | "resolved" | "closed";

export const INCIDENT_STATUSES: { value: IncidentStatus; label: string }[] = [
  { value: "open", label: "Abierta" },
  { value: "in_review", label: "En análisis" },
  { value: "resolved", label: "Resuelta" },
  { value: "closed", label: "Cerrada" },
];

export function incidentStatusLabel(value: string | null) {
  return INCIDENT_STATUSES.find((s) => s.value === value)?.label ?? "Abierta";
}

export function incidentStatusClasses(value: string | null) {
  switch (value) {
    case "resolved":
    case "closed":
      return "bg-primary/10 text-primary border-primary/30";
    case "in_review":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-destructive/10 text-destructive border-destructive/30";
  }
}

export const OPEN_INCIDENT_STATUSES: IncidentStatus[] = ["open", "in_review"];

export type IncidentInput = {
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  description: string;
  resolution: string;
};

export const EMPTY_INCIDENT: IncidentInput = {
  category: "other",
  priority: "medium",
  status: "open",
  description: "",
  resolution: "",
};

export async function listIncidents(bookingId: string): Promise<Incident[]> {
  const { data, error } = await supabase
    .from("booking_incidents")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAllIncidents(): Promise<Incident[]> {
  const { data, error } = await supabase
    .from("booking_incidents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createIncident(bookingId: string, input: IncidentInput) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sesión no válida");

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("user_id")
    .eq("id", bookingId)
    .single();
  if (bookingError) throw bookingError;

  const { error } = await supabase.from("booking_incidents").insert({
    booking_id: bookingId,
    user_id: booking.user_id,
    reported_by: uid,
    category: input.category,
    priority: input.priority,
    status: input.status,
    description: input.description.trim(),
    resolution: input.resolution.trim() || null,
  });
  if (error) throw error;
}

export async function updateIncident(
  id: string,
  patch: Partial<{
    category: IncidentCategory;
    priority: IncidentPriority;
    status: IncidentStatus;
    description: string;
    resolution: string | null;
  }>,
) {
  const { error } = await supabase.from("booking_incidents").update(patch).eq("id", id);
  if (error) throw error;
}

// ===================== Métricas =====================

export type ChecklistIncidentStats = {
  bookingsWithIncidents: number;
  openIncidents: number;
  urgentIncidents: number;
  readyToTravel: number;
  averageProgress: number;
};

export function computeChecklistIncidentStats(
  checklistByBooking: Map<string, ChecklistItem[]>,
  incidents: Incident[],
): ChecklistIncidentStats {
  const progresses = [...checklistByBooking.values()].map(computeChecklistProgress);
  const open = incidents.filter((i) => OPEN_INCIDENT_STATUSES.includes(i.status as IncidentStatus));

  return {
    bookingsWithIncidents: new Set(open.map((i) => i.booking_id)).size,
    openIncidents: open.length,
    urgentIncidents: open.filter((i) => i.priority === "urgent").length,
    readyToTravel: progresses.filter((p) => p.total > 0 && p.warnings.length === 0).length,
    averageProgress: progresses.length
      ? Math.round(progresses.reduce((acc, p) => acc + p.percent, 0) / progresses.length)
      : 0,
  };
}
