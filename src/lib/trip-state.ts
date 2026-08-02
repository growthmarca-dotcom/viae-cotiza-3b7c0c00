import { supabase } from "@/integrations/supabase/client";

/**
 * Estado operativo derivado del viaje (v1.9.5.3).
 *
 * NO reemplaza `bookings.status` (estado comercial, manual). Este estado se
 * calcula siempre al vuelo con la función de lectura `booking_trip_state`,
 * que analiza servicios, fechas, checklist crítico e incidencias bloqueantes.
 *
 * Preparado para materializarse en el futuro (columna en `bookings`,
 * dashboard operativo, alertas y eventos de timeline) sin cambiar el contrato.
 */

export type TripState =
  | "draft"
  | "quoted"
  | "partially_confirmed"
  | "confirmed"
  | "operational"
  | "finished"
  | "cancelled";

export const TRIP_STATES: { value: TripState; label: string }[] = [
  { value: "draft", label: "Borrador" },
  { value: "quoted", label: "Cotizado" },
  { value: "partially_confirmed", label: "Parcialmente confirmado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "operational", label: "En curso" },
  { value: "finished", label: "Finalizado" },
  { value: "cancelled", label: "Cancelado" },
];

export function tripStateLabel(value: string | null) {
  return TRIP_STATES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export function tripStateClasses(value: string | null) {
  switch (value) {
    case "confirmed":
    case "operational":
      return "bg-primary/10 text-primary border-primary/30";
    case "partially_confirmed":
      return "bg-gold/15 text-foreground border-gold/40";
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export type TripStateResult = {
  state: TripState;
  /** Motivo legible del estado calculado. */
  reason: string;
  /** Avance de confirmación de servicios (0-100). */
  progress: number;
  /** Servicios sin confirmar y tareas críticas pendientes. */
  pending_items: string[];
  services_total: number;
  services_confirmed: number;
  critical_total: number;
  critical_done: number;
  blocking_incidents: number;
};

function normalize(raw: unknown): TripStateResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const state = String(r.state ?? "draft") as TripState;
  return {
    state: TRIP_STATES.some((s) => s.value === state) ? state : "draft",
    reason: String(r.reason ?? ""),
    progress: Number(r.progress ?? 0),
    pending_items: Array.isArray(r.pending_items) ? r.pending_items.map(String) : [],
    services_total: Number(r.services_total ?? 0),
    services_confirmed: Number(r.services_confirmed ?? 0),
    critical_total: Number(r.critical_total ?? 0),
    critical_done: Number(r.critical_done ?? 0),
    blocking_incidents: Number(r.blocking_incidents ?? 0),
  };
}

/**
 * Lee el estado operativo de una reserva. Devuelve null si la reserva no
 * existe o el usuario no tiene permiso para verla (la función respeta RLS).
 */
export async function getTripState(bookingId: string): Promise<TripStateResult | null> {
  const { data, error } = await supabase.rpc("booking_trip_state", { _booking_id: bookingId });
  if (error) throw error;
  return normalize(data);
}

/** Estado operativo de varias reservas (para futuras vistas de bandeja). */
export async function getTripStates(bookingIds: string[]): Promise<Record<string, TripStateResult>> {
  const results = await Promise.all(
    bookingIds.map(async (id) => [id, await getTripState(id)] as const),
  );
  const map: Record<string, TripStateResult> = {};
  for (const [id, state] of results) if (state) map[id] = state;
  return map;
}
