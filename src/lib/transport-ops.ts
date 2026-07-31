import { supabase } from "@/integrations/supabase/client";
import type { Resource } from "@/lib/resources";
import {
  coverageOf,
  driverFullName,
  isDriverResource,
  vehicleDescription,
  type TransportService,
} from "@/lib/transport";

/**
 * Operación avanzada de transporte (v1.3).
 *
 * Agenda operativa (día / semana), control de asignación con advertencias y
 * resúmenes del conductor. Todo es informativo: nunca bloquea una asignación,
 * sólo le avisa al administrador lo que puede estar en conflicto.
 *
 * Preparado para el futuro (GPS, WhatsApp real, liquidaciones y comisiones)
 * pero deliberadamente sin implementarlo.
 */

// ------------------------------------------------------------ fechas

export function toISODate(d: Date) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Lunes a domingo de la semana que contiene `iso`. */
export function weekDays(iso: string): string[] {
  const d = new Date(`${iso}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  const monday = addDays(iso, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatDayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

export function timeLabel(t: string | null) {
  return t ? String(t).slice(0, 5) : "--:--";
}

function minutesOf(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

/** Duración por defecto cuando el servicio no la declara (v1.4). */
export const FALLBACK_DURATION_MINUTES = 60;

export type TimeInterval = { start: number; end: number };

/** Ventana ocupada por un servicio, en minutos desde la medianoche. */
export function serviceInterval(
  time: string | null,
  durationMinutes: number | null,
): TimeInterval | null {
  const start = minutesOf(time);
  if (start == null) return null;
  const duration = durationMinutes ?? FALLBACK_DURATION_MINUTES;
  return { start, end: start + Math.max(0, duration) };
}

export function minutesToLabel(total: number) {
  const norm = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(norm / 60)).padStart(2, "0")}:${String(norm % 60).padStart(2, "0")}`;
}

/** Hora estimada de finalización con formato HH:MM. */
export function endTimeLabel(time: string | null, durationMinutes: number | null) {
  const interval = serviceInterval(time, durationMinutes);
  return interval ? minutesToLabel(interval.end) : "--:--";
}


// ------------------------------------------------------------ agenda

export type AgendaGroup = "today" | "upcoming" | "running" | "finished";

const RUNNING = ["en_route", "at_origin", "in_transit"];
const CLOSED = ["completed", "cancelled", "rejected"];

export function agendaGroupOf(s: TransportService, today = todayISO()): AgendaGroup {
  if (RUNNING.includes(s.status)) return "running";
  if (CLOSED.includes(s.status)) return "finished";
  if (s.service_date && s.service_date > today) return "upcoming";
  if (s.service_date && s.service_date < today) return "finished";
  return "today";
}

export function groupAgenda(services: TransportService[], today = todayISO()) {
  const groups: Record<AgendaGroup, TransportService[]> = {
    today: [],
    running: [],
    upcoming: [],
    finished: [],
  };
  for (const s of services) groups[agendaGroupOf(s, today)].push(s);
  return groups;
}

export function sortByTime(services: TransportService[]) {
  return [...services].sort((a, b) => {
    const da = `${a.service_date ?? "9999-12-31"} ${a.service_time ?? "99:99"}`;
    const db = `${b.service_date ?? "9999-12-31"} ${b.service_time ?? "99:99"}`;
    return da.localeCompare(db);
  });
}

export function servicesOfDay(services: TransportService[], iso: string) {
  return sortByTime(services.filter((s) => s.service_date === iso));
}

/** Datos mínimos de la reserva asociada, para mostrar el cliente en la agenda. */
export type ServiceBookingInfo = { booking_number: string | null; client_name: string | null };

export async function listServiceBookingInfo(
  bookingIds: string[],
): Promise<Map<string, ServiceBookingInfo>> {
  const ids = Array.from(new Set(bookingIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, booking_number, clients(full_name)")
    .in("id", ids);
  if (error) throw error;
  const map = new Map<string, ServiceBookingInfo>();
  for (const row of (data ?? []) as {
    id: string;
    booking_number: string | null;
    clients: { full_name: string | null } | null;
  }[]) {
    map.set(row.id, {
      booking_number: row.booking_number,
      client_name: row.clients?.full_name ?? null,
    });
  }
  return map;
}

// -------------------------------------------------- control de asignación

export type AssignmentWarning = {
  level: "warning" | "info";
  message: string;
};

export type AssignmentContext = {
  serviceId?: string | null;
  date: string | null;
  time: string | null;
  /** Duración estimada del servicio a asignar, en minutos (v1.4). */
  durationMinutes?: number | null;
  paxCount: number | null;
  luggageCount: number | null;
  origin?: string | null;
  /** Margen operativo entre dos servicios consecutivos, en minutos. */
  bufferMinutes?: number;
};


/** Servicios futuros/activos ya asignados a un recurso. */
export function futureServicesOf(
  services: TransportService[],
  resourceId: string,
  today = todayISO(),
) {
  return sortByTime(
    services.filter(
      (s) =>
        s.record_status === "active" &&
        !CLOSED.includes(s.status) &&
        (s.driver_resource_id === resourceId || s.vehicle_resource_id === resourceId) &&
        (s.service_date == null || s.service_date >= today),
    ),
  );
}

/**
 * Advertencias antes de asignar un recurso. No bloquea: sólo informa.
 */
export function assignmentWarnings(
  resource: Resource,
  services: TransportService[],
  ctx: AssignmentContext,
): AssignmentWarning[] {
  const out: AssignmentWarning[] = [];
  const isDriver = isDriverResource(resource);
  const buffer = ctx.bufferMinutes ?? 15;

  if (resource.availability === "off_hours")
    out.push({ level: "warning", message: "El recurso está fuera de horario." });
  if (resource.availability === "unavailable" || resource.availability === "out_of_service")
    out.push({ level: "warning", message: "El recurso figura como no disponible." });
  if (resource.availability === "busy" || resource.availability === "in_service")
    out.push({ level: "info", message: "El recurso está actualmente en viaje." });
  if (resource.availability === "assigned" || resource.availability === "reserved")
    out.push({
      level: "info",
      message: isDriver ? "El conductor ya tiene servicios asignados." : "El vehículo ya está reservado.",
    });

  if (ctx.paxCount && resource.pax_capacity != null && resource.pax_capacity < ctx.paxCount)
    out.push({
      level: "warning",
      message: `Capacidad insuficiente: ${resource.pax_capacity} pasajeros para ${ctx.paxCount} solicitados.`,
    });
  if (
    ctx.luggageCount &&
    resource.luggage_capacity != null &&
    resource.luggage_capacity < ctx.luggageCount
  )
    out.push({
      level: "warning",
      message: `Capacidad de equipaje insuficiente (${resource.luggage_capacity}).`,
    });

  if (ctx.origin && ctx.origin.trim() !== "") {
    const term = ctx.origin.trim().toLowerCase();
    const covers = coverageOf(resource).some(
      (c) => c.toLowerCase().includes(term) || term.includes(c.toLowerCase()),
    );
    if (!covers)
      out.push({
        level: "info",
        message: `El origen "${ctx.origin}" está fuera de su zona de cobertura declarada.`,
      });
  }

  if (resource.requires_advance_booking && resource.advance_notice_hours && ctx.date) {
    const start = new Date(`${ctx.date}T${(ctx.time || "00:00").slice(0, 5)}:00`);
    const hours = (start.getTime() - Date.now()) / 3600000;
    if (hours < resource.advance_notice_hours)
      out.push({
        level: "warning",
        message: `Requiere ${resource.advance_notice_hours} h de aviso previo y faltan ${Math.max(0, Math.round(hours))} h.`,
      });
  }

  // Conflicto horario por solapamiento de duración estimada (v1.4)
  if (ctx.date) {
    const mine = serviceInterval(ctx.time, ctx.durationMinutes ?? null);
    const conflicts = services.filter((s) => {
      if (s.id === ctx.serviceId) return false;
      if (s.record_status !== "active" || CLOSED.includes(s.status)) return false;
      if (s.service_date !== ctx.date) return false;
      const sameDriver = s.driver_resource_id === resource.id;
      const sameVehicle = s.vehicle_resource_id === resource.id;
      if (!sameDriver && !sameVehicle) return false;
      if (!mine) return true;
      const other = serviceInterval(s.service_time ? String(s.service_time) : null, s.duration_minutes);
      if (!other) return true;
      return mine.start < other.end + buffer && other.start < mine.end + buffer;
    });
    for (const c of conflicts) {
      const end = endTimeLabel(c.service_time ? String(c.service_time) : null, c.duration_minutes);
      out.push({
        level: "warning",
        message: `${isDriver ? "El conductor" : "El vehículo"} ya tiene un servicio el ${c.service_date} de ${timeLabel(c.service_time)} a ${end} (${c.origin ?? "—"} → ${c.destination ?? "—"}).`,
      });
    }
  }


  return out;
}

export function resourceHeadline(r: Resource) {
  return isDriverResource(r) ? driverFullName(r) : vehicleDescription(r);
}

// ---------------------------------------------------- resumen del conductor

export type DriverDaySummary = {
  pending: number;
  accepted: number;
  finished: number;
  pendingCollection: number;
  pendingCollectionAmount: number;
  currency: string;
};

export function driverDaySummary(
  services: TransportService[],
  today = todayISO(),
): DriverDaySummary {
  const ofDay = services.filter((s) => s.service_date === today);
  const pendingCollection = services.filter(
    (s) => s.collection_status === "pending" && s.status !== "cancelled" && s.status !== "rejected",
  );
  return {
    pending: ofDay.filter((s) => ["pending", "requested", "assigned"].includes(s.status)).length,
    accepted: ofDay.filter((s) => ["accepted", ...RUNNING].includes(s.status)).length,
    finished: ofDay.filter((s) => s.status === "completed").length,
    pendingCollection: pendingCollection.length,
    pendingCollectionAmount: pendingCollection.reduce(
      (acc, s) => acc + Number(s.collection_amount ?? 0),
      0,
    ),
    currency: pendingCollection[0]?.collection_currency ?? "ARS",
  };
}

export type DriverFilter = "today" | "upcoming" | "history";

export function filterDriverServices(
  services: TransportService[],
  filter: DriverFilter,
  today = todayISO(),
) {
  const rows = sortByTime(services);
  if (filter === "today")
    return rows.filter((s) => s.service_date === today || RUNNING.includes(s.status));
  if (filter === "upcoming")
    return rows.filter(
      (s) => (s.service_date == null || s.service_date > today) && !CLOSED.includes(s.status),
    );
  return rows.filter(
    (s) => CLOSED.includes(s.status) || (s.service_date != null && s.service_date < today),
  );
}

// ------------------------------------------------- filtros de agenda (v1.4)

export type AgendaFilters = {
  state?: string;
  city?: string;
  zone?: string;
  serviceType?: string;
  driverResourceId?: string;
  vehicleResourceId?: string;
};

export const AGENDA_ALL = "all";

function matches(value: string | null | undefined, filter?: string) {
  if (!filter || filter === AGENDA_ALL) return true;
  return (value ?? "") === filter;
}

/** Filtra servicios por ubicación estructurada, tipo y recursos asignados. */
export function applyAgendaFilters(
  services: TransportService[],
  filters: AgendaFilters,
): TransportService[] {
  return services.filter(
    (s) =>
      matches(s.state, filters.state) &&
      matches(s.city, filters.city) &&
      matches(s.tourist_zone, filters.zone) &&
      matches(s.service_type, filters.serviceType) &&
      matches(s.driver_resource_id, filters.driverResourceId) &&
      matches(s.vehicle_resource_id, filters.vehicleResourceId),
  );
}

export type LoadBucket = { key: string; count: number; minutes: number };

function bucketBy(
  services: TransportService[],
  pick: (s: TransportService) => string | null,
): LoadBucket[] {
  const map = new Map<string, LoadBucket>();
  for (const s of services) {
    const key = pick(s) || "Sin definir";
    const current = map.get(key) ?? { key, count: 0, minutes: 0 };
    current.count += 1;
    current.minutes += s.duration_minutes ?? FALLBACK_DURATION_MINUTES;
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** Carga operativa por zona turística. */
export function loadByZone(services: TransportService[]) {
  return bucketBy(services, (s) => s.tourist_zone);
}

/** Carga operativa por destino. */
export function loadByDestination(services: TransportService[]) {
  return bucketBy(services, (s) => s.destination);
}

/** Cantidad de servicios por día. */
export function loadByDay(services: TransportService[]) {
  return bucketBy(services, (s) => s.service_date).sort((a, b) => a.key.localeCompare(b.key));
}

/** Valores presentes en los servicios, para alimentar los selectores. */
export function agendaFacets(services: TransportService[]) {
  const uniq = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== ""))).sort();
  return {
    states: uniq(services.map((s) => s.state)),
    cities: uniq(services.map((s) => s.city)),
    zones: uniq(services.map((s) => s.tourist_zone)),
  };
}

// ------------------------------------------- agenda personal del conductor

export type DriverAgenda = {
  today: TransportService[];
  upcoming: TransportService[];
  /** Minutos estimados ocupados hoy. */
  busyMinutesToday: number;
  /** Minutos estimados ocupados en los próximos servicios. */
  busyMinutesUpcoming: number;
  /** Próxima disponibilidad estimada (fin del último servicio activo de hoy). */
  nextAvailableAt: string | null;
  /** Próximo servicio agendado. */
  nextService: TransportService | null;
};

export function driverAgenda(services: TransportService[], today = todayISO()): DriverAgenda {
  const open = services.filter((s) => s.record_status === "active" && !CLOSED.includes(s.status));
  const ofToday = sortByTime(open.filter((s) => s.service_date === today));
  const upcoming = sortByTime(
    open.filter((s) => s.service_date != null && s.service_date > today),
  );
  const minutes = (list: TransportService[]) =>
    list.reduce((acc, s) => acc + (s.duration_minutes ?? FALLBACK_DURATION_MINUTES), 0);

  let nextAvailableAt: string | null = null;
  const ends = ofToday
    .map((s) => serviceInterval(s.service_time ? String(s.service_time) : null, s.duration_minutes))
    .filter((i): i is TimeInterval => i != null)
    .map((i) => i.end);
  if (ends.length > 0) nextAvailableAt = minutesToLabel(Math.max(...ends));

  return {
    today: ofToday,
    upcoming,
    busyMinutesToday: minutes(ofToday),
    busyMinutesUpcoming: minutes(upcoming),
    nextAvailableAt,
    nextService: ofToday[0] ?? upcoming[0] ?? null,
  };
}

export function hoursLabel(minutes: number) {
  if (minutes <= 0) return "0 h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
