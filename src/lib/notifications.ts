import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Centro de notificaciones internas (v1.4).
 *
 * La tabla es genérica (`kind`, `entity`, `data`) y la generan triggers de la
 * base: asignaciones, cambios de estado del servicio, cambios de horario y
 * cobros informados. Cada usuario ve únicamente sus notificaciones (RLS) y la
 * lectura queda auditada mediante `mark_notifications_read`.
 */

export type Notification = Tables<"notifications">;

export type AssignmentPayload = {
  service_date?: string | null;
  service_time?: string | null;
  origin?: string | null;
  destination?: string | null;
  pax_count?: number | null;
  luggage_count?: number | null;
  collection_status?: string | null;
  collection_amount?: number | null;
  collection_currency?: string | null;
  payment_mode?: string | null;
  booking_number?: string | null;
  client_name?: string | null;
};

export function assignmentPayload(n: Notification): AssignmentPayload {
  return (n.data ?? {}) as AssignmentPayload;
}

const KIND_LABEL: Record<string, string> = {
  transport_assignment: "Traslado asignado",
  transport_status: "Estado del servicio",
  transport_schedule: "Cambio de horario",
  transport_collection: "Cobro informado",
};

export function notificationKindLabel(kind: string) {
  return KIND_LABEL[kind] ?? "Aviso";
}

export function notificationKindClasses(kind: string) {
  switch (kind) {
    case "transport_assignment":
      return "bg-gold/15 text-foreground border-gold/40";
    case "transport_collection":
      return "bg-primary/10 text-primary border-primary/30";
    case "transport_schedule":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function formatNotificationDate(value: string) {
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export async function listMyNotifications(limit = 30): Promise<Notification[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export function unreadCount(list: Notification[]) {
  return list.filter((n) => n.read_at == null).length;
}

/** La lectura se registra en la auditoría desde la base. */
export async function markNotificationRead(id: string) {
  const { error } = await supabase.rpc("mark_notifications_read", { _ids: [id] });
  if (error) throw error;
}

export async function markAllNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc("mark_notifications_read", { _ids: ids });
  if (error) throw error;
}


/**
 * Suscripción en tiempo real a las notificaciones del usuario (v1.5).
 * Reemplaza el polling: la campana se actualiza al instante y sólo recibe
 * las filas propias (además del filtro de RLS).
 */
export function subscribeToMyNotifications(userId: string, onChange: () => void) {
  // Nombre único por suscripción: reutilizar un canal ya suscripto provoca
  // "cannot add postgres_changes callbacks after subscribe()".
  const channel = supabase
    .channel(`notifications:${userId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Id del usuario autenticado (helper para suscripciones). */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
