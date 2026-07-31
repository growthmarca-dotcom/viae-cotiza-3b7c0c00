import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Eventos de comunicación (v1.5).
 *
 * Cola de mensajes preparada para una futura integración con WhatsApp.
 * Los eventos los generan triggers de la base cuando se asigna un viaje,
 * cambia el horario, el conductor confirma o finaliza el servicio.
 * En esta versión NO se envía nada: sólo se registra, se audita y se muestra.
 */

export type CommunicationEvent = Tables<"communication_events">;

export type CommunicationEventType =
  | "trip_assigned"
  | "trip_reminder"
  | "schedule_changed"
  | "service_confirmed"
  | "trip_completed";

export type CommunicationEventStatus = "pending" | "sent" | "error";

const TYPE_LABEL: Record<string, string> = {
  trip_assigned: "Nuevo viaje asignado",
  trip_reminder: "Recordatorio de viaje próximo",
  schedule_changed: "Cambio de horario",
  service_confirmed: "Confirmación de servicio",
  trip_completed: "Finalización de viaje",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  error: "Error",
};

export function communicationTypeLabel(value: string) {
  return TYPE_LABEL[value] ?? value;
}

export function communicationStatusLabel(value: string) {
  return STATUS_LABEL[value] ?? value;
}

export function communicationStatusClasses(value: string) {
  switch (value) {
    case "sent":
      return "bg-primary/10 text-primary border-primary/30";
    case "error":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-gold/15 text-foreground border-gold/40";
  }
}

export function formatEventDate(value: string) {
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export type CommunicationFilters = {
  status?: CommunicationEventStatus | "all";
  type?: CommunicationEventType | "all";
};

/** Eventos visibles según RLS (admin ve todo; el resto, los propios). */
export async function listCommunicationEvents(
  filters: CommunicationFilters = {},
  limit = 100,
): Promise<CommunicationEvent[]> {
  let q = supabase
    .from("communication_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.type && filters.type !== "all") q = q.eq("event_type", filters.type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CommunicationEvent[];
}

export function communicationSummary(list: CommunicationEvent[]) {
  return {
    total: list.length,
    pending: list.filter((e) => e.status === "pending").length,
    sent: list.filter((e) => e.status === "sent").length,
    error: list.filter((e) => e.status === "error").length,
  };
}
