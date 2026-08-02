import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";

/**
 * Lectura del expediente narrativo de la reserva (v1.9.5.4).
 *
 * `booking_timeline` es append-only y se alimenta SOLO desde triggers internos
 * (v1.9.5.2 A). Esta capa es de lectura: nunca inserta, actualiza ni borra.
 */

export type TimelineEvent = Tables<"booking_timeline">;
export type TimelineEventType = Enums<"booking_timeline_event">;
export type TimelineVisibility = Enums<"timeline_visibility">;

const EVENT_LABEL: Record<TimelineEventType, string> = {
  created: "Reserva creada",
  updated: "Actualización",
  status_changed: "Cambio de estado",
  payment_received: "Pago registrado",
  service_confirmed: "Servicio confirmado",
  provider_confirmed: "Proveedor confirmado",
  resource_assigned: "Recurso asignado",
  document_added: "Documento agregado",
  checklist_completed: "Ítem de checklist completado",
  incident_opened: "Incidencia abierta",
  incident_resolved: "Incidencia resuelta",
  communication_sent: "Comunicación enviada",
  communication_read: "Comunicación leída",
};

export function timelineEventLabel(value: string) {
  return EVENT_LABEL[value as TimelineEventType] ?? value;
}

/** Agrupación visual de eventos para los filtros del expediente. */
export type TimelineCategory = "all" | "operation" | "payments" | "documents" | "communication";

export const TIMELINE_CATEGORIES: { value: TimelineCategory; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "operation", label: "Operación" },
  { value: "payments", label: "Pagos" },
  { value: "documents", label: "Documentos" },
  { value: "communication", label: "Comunicación" },
];

const CATEGORY_OF: Record<TimelineEventType, Exclude<TimelineCategory, "all">> = {
  created: "operation",
  updated: "operation",
  status_changed: "operation",
  service_confirmed: "operation",
  provider_confirmed: "operation",
  resource_assigned: "operation",
  checklist_completed: "operation",
  incident_opened: "operation",
  incident_resolved: "operation",
  payment_received: "payments",
  document_added: "documents",
  communication_sent: "communication",
  communication_read: "communication",
};

export function timelineCategoryOf(value: string): Exclude<TimelineCategory, "all"> {
  return CATEGORY_OF[value as TimelineEventType] ?? "operation";
}

export function timelineEventClasses(value: string) {
  switch (timelineCategoryOf(value)) {
    case "payments":
      return "bg-primary/10 text-primary border-primary/30";
    case "documents":
      return "bg-secondary text-secondary-foreground border-border";
    case "communication":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function formatTimelineDate(value: string) {
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

/** Detalle legible del evento a partir del metadata guardado por los triggers. */
export function timelineEventDetail(event: TimelineEvent): string | null {
  const meta = (event.metadata ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  const push = (key: string, label?: string) => {
    const v = meta[key];
    if (v == null || v === "") return;
    parts.push(label ? `${label}: ${String(v)}` : String(v));
  };
  push("title");
  push("label");
  push("from_status", "desde");
  push("to_status", "hacia");
  push("amount", "importe");
  push("currency");
  push("kind", "tipo");
  push("event_type", "evento");
  return parts.length ? parts.join(" · ") : null;
}

/** Eventos visibles según RLS (proveedor y cliente no tienen acceso). */
export async function listBookingTimeline(bookingId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from("booking_timeline")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TimelineEvent[];
}
