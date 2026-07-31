import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Seguimiento del viaje para el cliente (v1.5).
 *
 * Sólo la preparación: cada reserva tiene un token de seguimiento y un estado
 * simplificado que la base mantiene sincronizado con los servicios de
 * transporte. La información sensible nunca se expone: la lectura pública se
 * hace por RPC (`booking_public_tracking`) y devuelve campos mínimos.
 */

export type ClientTripStatus =
  Database["public"]["Enums"]["client_trip_status"];

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado",
  driver_assigned: "Conductor asignado",
  preparing: "En preparación",
  on_the_way: "En camino",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

export const CLIENT_TRIP_FLOW: ClientTripStatus[] = [
  "confirmed",
  "driver_assigned",
  "preparing",
  "on_the_way",
  "finished",
];

export function clientStatusLabel(value: string | null) {
  return STATUS_LABEL[value ?? ""] ?? "Confirmado";
}

export function clientStatusClasses(value: string | null) {
  switch (value) {
    case "on_the_way":
      return "bg-gold/15 text-foreground border-gold/40";
    case "finished":
      return "bg-primary/10 text-primary border-primary/30";
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Habilita o deshabilita el seguimiento público de una reserva. */
export async function setTrackingEnabled(bookingId: string, enabled: boolean) {
  const { error } = await supabase
    .from("bookings")
    .update({ tracking_enabled: enabled })
    .eq("id", bookingId);
  if (error) throw error;
}

export function trackingUrl(token: string) {
  if (typeof window === "undefined") return `/seguimiento/${token}`;
  return `${window.location.origin}/seguimiento/${token}`;
}

export type PublicTracking = {
  booking_number: string | null;
  destination: string | null;
  travel_start: string | null;
  travel_end: string | null;
  client_status: ClientTripStatus;
  updated_at: string;
};

/** Lectura pública por token (sin datos privados del cliente). */
export async function fetchPublicTracking(token: string): Promise<PublicTracking | null> {
  const { data, error } = await supabase.rpc("booking_public_tracking", { _token: token });
  if (error) throw error;
  const rows = (data ?? []) as PublicTracking[];
  return rows[0] ?? null;
}
