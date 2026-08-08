import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Compass, Download, Loader2, MapPin, Moon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { getPublicSmartQuote } from "@/lib/public-smart-quote.functions";

export const Route = createFileRoute("/propuesta/$token")({
  component: PublicSmartQuotePage,
  head: () => ({
    meta: [
      { title: "Tu propuesta de viaje" },
      { name: "description", content: "Detalle de los servicios y la inversión de tu viaje." },
      { property: "og:title", content: "Tu propuesta de viaje" },
      {
        property: "og:description",
        content: "Detalle de los servicios y la inversión de tu viaje.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // Propuesta privada compartida por enlace: no debe indexarse.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PublicSmartQuotePage() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(getPublicSmartQuote);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-smart-quote", token],
    queryFn: () => fetchFn({ data: { token } }),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando propuesta...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Propuesta no encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El enlace es inválido, fue revocado o la propuesta ya no está disponible.
        </p>
      </div>
    );
  }

  const { quote: q, items, branding } = data;
  const contactLines = [branding.whatsapp, branding.email, branding.website, branding.address].filter(
    Boolean,
  ) as string[];
  const socialLines = [
    branding.instagram && `Instagram: ${branding.instagram}`,
    branding.facebook && `Facebook: ${branding.facebook}`,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card" style={{ borderBottomColor: branding.accentColor }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.organizationName ?? "Logo"}
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <div
                className="grid h-9 w-9 place-items-center rounded-lg text-white"
                style={{ background: branding.primaryColor }}
              >
                <Compass className="h-5 w-5" />
              </div>
            )}
            {branding.organizationName ? (
              <span
                className="block truncate font-display text-lg font-semibold tracking-tight"
                style={{ color: branding.primaryColor }}
              >
                {branding.organizationName}
              </span>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" /> Descargar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 py-10 pb-24">
        <section>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Propuesta de viaje</p>
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{q.title}</h1>
          {q.destination && (
            <p className="mt-3 flex items-center gap-2 text-lg text-muted-foreground">
              <MapPin className="h-5 w-5 text-primary" /> {q.destination}
            </p>
          )}
        </section>

        <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-4">
          <Stat
            icon={<Calendar className="h-4 w-4" />}
            label="Ingreso"
            value={q.start_date ? new Date(q.start_date).toLocaleDateString() : null}
          />
          <Stat
            icon={<Calendar className="h-4 w-4" />}
            label="Salida"
            value={q.end_date ? new Date(q.end_date).toLocaleDateString() : null}
          />
          <Stat icon={<Moon className="h-4 w-4" />} label="Noches" value={q.nights} />
          <Stat icon={<Users className="h-4 w-4" />} label="Pasajeros" value={q.passengers_total} />
        </section>

        {q.passengers.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold">Pasajeros</h2>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {q.passengers.map((p) => (
                <li
                  key={p.label}
                  className="rounded-full border border-border bg-background px-3 py-1"
                >
                  {p.label}: <span className="font-medium">{p.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-2xl font-semibold">Servicios incluidos</h2>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Todavía no hay servicios detallados en esta propuesta.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {items.map((it) => (
                <li key={it.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                  <div className="min-w-0 max-w-md">
                    <p className="font-medium">{it.title}</p>
                    {it.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {it.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {it.quantity} × {formatMoney(q.currency, it.unit_amount)}
                    </p>
                  </div>
                  <span className="font-display text-lg font-semibold">
                    {formatMoney(q.currency, it.total_amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="rounded-2xl border p-6"
          style={{
            borderColor: `${branding.accentColor}66`,
            background: `${branding.primaryColor}0D`,
          }}
        >
          <h2 className="font-display text-2xl font-semibold" style={{ color: branding.primaryColor }}>
            Inversión
          </h2>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-display text-lg font-semibold">Total ({q.currency})</span>
            <span
              className="font-display text-3xl font-semibold"
              style={{ color: branding.primaryColor }}
            >
              {formatMoney(q.currency, q.total_amount)}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Todos los importes se expresan en {q.currency}. Propuesta emitida el{" "}
            {new Date(q.created_at).toLocaleDateString()}
            {q.share_expires_at
              ? ` · válida hasta el ${new Date(q.share_expires_at).toLocaleDateString()}`
              : ""}
            .
          </p>
        </section>

        <footer
          className="mt-4 space-y-2 border-t pt-6 text-center text-xs text-muted-foreground"
          style={{ borderTopColor: `${branding.accentColor}66` }}
        >
          {branding.organizationName ? (
            <div className="font-medium" style={{ color: branding.primaryColor }}>
              {branding.organizationName}
            </div>
          ) : null}
          {contactLines.length > 0 && <div>{contactLines.join(" · ")}</div>}
          {socialLines.length > 0 && <div>{socialLines.join(" · ")}</div>}
          <div>{branding.footerText ?? "Propuesta sin valor contractual."}</div>
        </footer>
      </main>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: unknown;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-lg font-medium">
        {value == null || value === "" ? "—" : String(value)}
      </div>
    </div>
  );
}
