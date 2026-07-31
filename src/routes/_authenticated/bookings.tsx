import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Loader2, Search, TicketCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { formatMoney, toAnalysisCurrency } from "@/lib/currency";
import { useAnalysisCurrency } from "@/hooks/use-analysis-currency";
import {
  BOOKING_STATUSES,
  bookingStatusClasses,
  bookingStatusLabel,
  computeBookingStats,
  listBookings,
  type BookingStatus,
} from "@/lib/bookings";

export const Route = createFileRoute("/_authenticated/bookings")({
  component: BookingsPage,
  head: () => ({
    meta: [
      { title: "Reservas — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Gestioná las reservas generadas desde oportunidades y cotizaciones: estados, viajes del mes y valor total reservado.",
      },
      { property: "og:title", content: "Reservas — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Seguimiento operativo de reservas, pagos, documentación y proveedores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BookingsPage() {
  const analysisCurrency = useAnalysisCurrency();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [includeArchived, setIncludeArchived] = useState(false);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", search, status, includeArchived],
    queryFn: () => listBookings({ search, status, includeArchived }),
  });

  const rows = useMemo(() => bookings ?? [], [bookings]);

  const clientIds = [...new Set(rows.map((b) => b.client_id))];
  const { data: clients } = useQuery({
    queryKey: ["bookings-clients", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, last_name")
        .in("id", clientIds);
      return data ?? [];
    },
  });
  const clientName = new Map(
    (clients ?? []).map((c) => [c.id, [c.full_name, c.last_name].filter(Boolean).join(" ")]),
  );

  const stats = computeBookingStats(rows, (amount, currency, rate) =>
    toAnalysisCurrency(amount, currency, analysisCurrency, rate),
  );

  return (
    <div className="space-y-8 pb-16">
      <header>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <TicketCheck className="h-3.5 w-3.5 text-gold" /> Operaciones
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Reservas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Las reservas se generan desde una oportunidad o una cotización. Desde aquí seguís su
          estado, pagos, documentación y proveedor.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Reservas pendientes" value={String(stats.pending)} />
        <Stat label="Reservas confirmadas" value={String(stats.confirmed)} />
        <Stat label="Reservas canceladas" value={String(stats.cancelled)} />
        <Stat label="Viajes del mes" value={String(stats.travelsThisMonth)} />
        <Stat
          label={`Valor total reservado (${analysisCurrency})`}
          value={formatMoney(analysisCurrency, stats.totalValue)}
        />
      </section>
      {stats.excluded > 0 && (
        <p className="-mt-4 text-xs text-muted-foreground">
          {stats.excluded} reserva(s) no se incluyen en el total porque falta el tipo de cambio para
          convertirlas a {analysisCurrency}.
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, destino, proveedor..."
              className="pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BookingStatus | "all")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todos los estados</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Ver archivadas
          </label>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando reservas...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-xl font-semibold">Todavía no hay reservas</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Abrí una oportunidad del pipeline o una cotización y usá el botón{" "}
            <strong>Generar reserva</strong>. Las reservas nunca se crean de forma directa.
          </p>
          <Link
            to="/quotations"
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Ir a cotizaciones
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3">Viaje</th>
                <th className="px-4 py-3">Importe</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-border/60 hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">
                    <Link to="/bookings/$id" params={{ id: b.id }} className="hover:text-primary">
                      {b.booking_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{clientName.get(b.client_id) ?? "—"}</td>
                  <td className="px-4 py-3">{b.destination ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {b.travel_start ?? "—"}
                    {b.travel_end ? ` → ${b.travel_end}` : ""}
                  </td>
                  <td className="px-4 py-3">{formatMoney(b.currency, Number(b.amount ?? 0))}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${bookingStatusClasses(b.status)}`}
                    >
                      {bookingStatusLabel(b.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <span className="text-sm text-muted-foreground">{label}</span>
      <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
