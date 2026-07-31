import { useState } from "react";
import { Copy, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CLIENT_TRIP_FLOW,
  clientStatusClasses,
  clientStatusLabel,
  setTrackingEnabled,
  trackingUrl,
  type ClientTripStatus,
} from "@/lib/client-tracking";

/**
 * Seguimiento del viaje para el cliente (v1.5).
 * El estado lo mantiene la base según los servicios de transporte; acá sólo se
 * consulta, se habilita el enlace público y se copia. Sin datos privados.
 */
export function BookingTrackingCard({
  bookingId,
  status,
  token,
  enabled,
  onChanged,
}: {
  bookingId: string;
  status: ClientTripStatus | null;
  token: string;
  enabled: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const url = trackingUrl(token);
  const current = status ?? "confirmed";

  async function toggle() {
    setBusy(true);
    try {
      await setTrackingEnabled(bookingId, !enabled);
      toast.success(enabled ? "Seguimiento deshabilitado" : "Seguimiento habilitado");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el seguimiento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Radio className="h-4 w-4 text-gold" /> Seguimiento del cliente
        </h3>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${clientStatusClasses(current)}`}
        >
          {clientStatusLabel(current)}
        </span>
      </div>

      <ol className="mt-3 flex flex-wrap gap-2 text-xs">
        {CLIENT_TRIP_FLOW.map((step) => {
          const idx = CLIENT_TRIP_FLOW.indexOf(current as ClientTripStatus);
          const done = idx >= 0 && CLIENT_TRIP_FLOW.indexOf(step) <= idx;
          return (
            <li
              key={step}
              className={`rounded-full border px-2.5 py-1 ${
                done ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {clientStatusLabel(step)}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={enabled ? "default" : "outline"} disabled={busy} onClick={toggle}>
          {enabled ? "Seguimiento habilitado" : "Habilitar seguimiento"}
        </Button>
        {enabled && (
          <>
            <code className="max-w-full truncate rounded bg-secondary px-2 py-1 text-xs">{url}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success("Enlace copiado");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
            </Button>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        El enlace muestra sólo el estado del viaje, el destino y las fechas. Nunca datos de
        contacto, importes ni información del conductor.
      </p>
    </div>
  );
}
