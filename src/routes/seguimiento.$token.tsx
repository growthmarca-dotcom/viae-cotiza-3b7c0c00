import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import {
  CLIENT_TRIP_FLOW,
  clientStatusClasses,
  clientStatusLabel,
  fetchPublicTracking,
  type PublicTracking,
} from "@/lib/client-tracking";

export const Route = createFileRoute("/seguimiento/$token")({
  component: TrackingPage,
  head: () => ({
    meta: [
      { title: "Seguimiento de tu viaje" },
      {
        name: "description",
        content: "Consultá el estado de tu viaje en tiempo real con tu enlace de seguimiento.",
      },
      { property: "og:title", content: "Seguimiento de tu viaje" },
      {
        property: "og:description",
        content: "Estado actualizado de tu reserva: confirmado, conductor asignado, en camino o finalizado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // Seguimiento privado por token: no debe indexarse.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

/**
 * Vista pública de seguimiento (v1.5, preparación).
 * Lee por RPC con token; la base sólo devuelve campos no sensibles y
 * únicamente si el responsable habilitó el seguimiento.
 */
function TrackingPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<PublicTracking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchPublicTracking(token)
      .then((r) => alive && setData(r))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gold text-gold-foreground">
          <Compass className="h-5 w-5" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Seguimiento de tu viaje</h1>

        {loading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando tu reserva...
          </p>
        ) : !data ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No encontramos un seguimiento activo para este enlace. Consultá con tu asesor.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.destination ?? "Tu viaje"} · {data.travel_start ?? "fecha a confirmar"}
              {data.travel_end ? ` → ${data.travel_end}` : ""}
            </p>
            <span
              className={`mt-6 inline-block rounded-full border px-4 py-1.5 text-sm font-medium ${clientStatusClasses(data.client_status)}`}
            >
              {clientStatusLabel(data.client_status)}
            </span>
            <ol className="mt-6 space-y-2">
              {CLIENT_TRIP_FLOW.map((step) => {
                const idx = CLIENT_TRIP_FLOW.indexOf(data.client_status);
                const done = idx >= 0 && CLIENT_TRIP_FLOW.indexOf(step) <= idx;
                return (
                  <li
                    key={step}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${
                      done
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${done ? "bg-primary" : "bg-border"}`}
                    />
                    {clientStatusLabel(step)}
                  </li>
                );
              })}
            </ol>
            <p className="mt-6 text-xs text-muted-foreground">
              Actualizado el {new Date(data.updated_at).toLocaleString("es-AR")}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
