import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Notificaciones internas (v1.3).
 *
 * Hoy sólo se generan desde la base cuando se asigna un servicio de
 * transporte a un conductor. La tabla es genérica (`kind`, `entity`, `data`)
 * para que en el futuro puedan sumarse otros avisos (WhatsApp, reservas,
 * pagos) sin cambiar el modelo.
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

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}
