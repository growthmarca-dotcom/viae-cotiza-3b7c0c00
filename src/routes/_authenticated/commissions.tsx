import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import {
  COMMISSION_STATUS_CLASSES,
  COMMISSION_STATUS_HELP,
  commissionStatusLabel,
  listMyCommissions,
  type CommissionStatus,
} from "@/lib/commissions";

export const Route = createFileRoute("/_authenticated/commissions")({
  component: MyCommissionsPage,
  head: () => ({
    meta: [
      { title: "Mis comisiones — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Consulta de comisiones devengadas por reserva y servicio, con estado, importe y fecha de devengo.",
      },
      { property: "og:title", content: "Mis comisiones — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Estado e importe de las comisiones registradas para cada reserva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/**
 * Resumen de comisiones del usuario actual. Es una vista de SOLO CONSULTA:
 * el recorte lo hace RLS (un agente sólo ve las propias) y no se muestran
 * costos, márgenes ni información financiera interna.
 */
function MyCommissionsPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-commissions"],
    queryFn: listMyCommissions,
  });

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.status === "cancelled" || r.commission_amount == null) continue;
      const cur = r.currency ?? "ARS";
      map.set(cur, Math.round(((map.get(cur) ?? 0) + Number(r.commission_amount)) * 100) / 100);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Comisiones registradas</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Mis comisiones
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vista de consulta: las comisiones se devengan, aprueban y cancelan desde Administración.
        </p>
      </header>

      <section className="flex flex-wrap gap-3">
        {totals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tenés comisiones registradas.</p>
        ) : (
          totals.map(([currency, amount]) => (
            <div
              key={currency}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <span className="text-sm text-muted-foreground">Vigentes en {currency}</span>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
                {formatMoney(currency, amount)}
              </p>
            </div>
          ))
        )}
      </section>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Wallet className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Cuando una reserva confirmada genere comisión, vas a verla acá.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const status = (r.status ?? "accrued") as CommissionStatus;
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.booking?.booking_number ? (
                        <Link
                          to="/bookings/$id"
                          params={{ id: r.booking.id }}
                          className="underline"
                        >
                          {r.booking.booking_number}
                        </Link>
                      ) : (
                        "Reserva"
                      )}
                      {r.service?.title ? ` · ${r.service.title}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {COMMISSION_STATUS_HELP[status]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${COMMISSION_STATUS_CLASSES[status]}`}
                    >
                      {commissionStatusLabel(status)}
                    </span>
                    <p className="font-display text-base font-semibold">
                      {r.commission_amount != null
                        ? formatMoney(r.currency ?? "ARS", Number(r.commission_amount))
                        : "—"}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Devengada el{" "}
                  {new Date(r.computed_at).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
