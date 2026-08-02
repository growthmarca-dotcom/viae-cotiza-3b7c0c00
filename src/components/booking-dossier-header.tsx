import { Building2, TicketCheck } from "lucide-react";
import { bookingStatusClasses, bookingStatusLabel, type Booking } from "@/lib/bookings";
import { tripStateClasses, tripStateLabel, type TripStateResult } from "@/lib/trip-state";
import { formatMoney } from "@/lib/currency";

/**
 * Cabecera del Expediente de Viaje 360° (v1.9.5.4).
 *
 * Muestra por separado el estado comercial (bookings.status, manual) y el
 * estado operativo derivado (booking_trip_state). No modifica ningún estado.
 */
export function BookingDossierHeader({
  booking,
  clientName,
  agentName,
  organizationName,
  tripState,
}: {
  booking: Booking;
  clientName: string;
  agentName: string | null;
  organizationName: string | null;
  tripState: TripStateResult | null;
}) {
  const pending = tripState?.pending_items ?? [];
  const progress = tripState?.progress ?? 0;

  return (
    <div className="sticky top-0 z-20 rounded-2xl border border-border bg-card/95 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            <TicketCheck className="h-3.5 w-3.5 text-gold" /> {booking.booking_number ?? "Sin número"}
          </span>
          <h1 className="mt-3 font-display text-3xl font-semibold">{clientName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.destination ?? "Sin destino"} · {booking.travel_start ?? "sin fecha"}
            {booking.travel_end ? ` → ${booking.travel_end}` : ""}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Agente: {agentName ?? "Sin asignar"}</span>
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> {organizationName ?? "Sin organización"}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap justify-end gap-4 text-right">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Estado comercial
              </p>
              <span
                className={`mt-1 inline-block rounded-full border px-3 py-1 text-xs font-medium ${bookingStatusClasses(booking.status)}`}
              >
                {bookingStatusLabel(booking.status)}
              </span>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Estado operativo
              </p>
              <span
                className={`mt-1 inline-block rounded-full border px-3 py-1 text-xs font-medium ${tripStateClasses(tripState?.state ?? null)}`}
              >
                {tripState ? tripStateLabel(tripState.state) : "Calculando..."}
              </span>
            </div>
          </div>
          <p className="font-display text-2xl font-semibold">
            {formatMoney(booking.currency, Number(booking.amount ?? 0))}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Avance del viaje</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          {tripState?.reason && (
            <p className="mt-2 text-xs text-muted-foreground">{tripState.reason}</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pendientes ({pending.length})
          </p>
          {pending.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Sin pendientes registrados.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {pending.slice(0, 4).map((p, i) => (
                <li key={`${p}-${i}`} className="text-muted-foreground">
                  · {p}
                </li>
              ))}
              {pending.length > 4 && (
                <li className="text-xs text-muted-foreground">
                  y {pending.length - 4} más...
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
