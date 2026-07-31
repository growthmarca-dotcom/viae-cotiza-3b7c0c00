import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Compass, Download, Loader2, MapPin, Calendar, Users, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicQuotation } from "@/lib/public-quotation.functions";
import { QuotationPrintDocument } from "@/components/quotation-print";


export const Route = createFileRoute("/cotizacion/$token")({
  component: PublicQuotationPage,
  head: () => ({
    meta: [
      { title: "Cotización de viaje — ViaE Sales Hub" },
      { name: "description", content: "Detalle de tu propuesta de viaje." },
      { property: "og:title", content: "Cotización de viaje — ViaE Sales Hub" },
      { property: "og:description", content: "Detalle de tu propuesta de viaje." },
    ],
  }),
});

function PublicQuotationPage() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(getPublicQuotation);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-quotation", token],
    queryFn: () => fetchFn({ data: { token } }),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando cotización...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Cotización no encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El enlace es inválido o la cotización ya no está disponible.
        </p>
      </div>
    );
  }

  const q = data.quotation;
  const urls: string[] = data.imageUrls ?? [];
  const company = data.company;
  const guestName = `${q.guest_first_name ?? ""} ${q.guest_last_name ?? ""}`.trim();

  return (
    <>
    <QuotationPrintDocument quotation={q} company={company} imageUrls={urls} />
    <div className="min-h-screen bg-background print-screen-hide">
      <header data-print-hide className="border-b border-border/60 bg-card">

        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-6 py-4">
          <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Compass className="h-5 w-5" />
          </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              ViaE <span className="text-gold">Sales Hub</span>
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" /> Descargar PDF
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10 pb-24">
        <section>
          {guestName && (
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Propuesta para {guestName}</p>
          )}
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{q.title}</h1>
          {q.destination && (
            <p className="mt-3 flex items-center gap-2 text-lg text-muted-foreground">
              <MapPin className="h-5 w-5 text-primary" /> {q.destination}
            </p>
          )}
        </section>

        {urls.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {urls.map((u, i) => (
              <div key={u} className={`overflow-hidden rounded-2xl border border-border ${i === 0 ? "sm:col-span-2 sm:row-span-2 aspect-[4/3]" : "aspect-square"}`}>
                <img src={u} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))}
          </section>
        )}

        <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-3">
          <Stat icon={<Calendar className="h-4 w-4" />} label="Ingreso" value={q.travel_start} />
          <Stat icon={<Calendar className="h-4 w-4" />} label="Salida" value={q.travel_end} />
          <Stat icon={<Moon className="h-4 w-4" />} label="Noches" value={q.nights} />
          <Stat icon={<Users className="h-4 w-4" />} label="Pasajeros" value={q.pax_count} />
        </section>

        {(q.accommodation_name || q.accommodation_description) && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-2xl font-semibold">Tu alojamiento</h2>
            {q.accommodation_name && <p className="mt-2 text-lg font-medium">{q.accommodation_name}</p>}
            {q.accommodation_address && <p className="text-sm text-muted-foreground">{q.accommodation_address}</p>}
            {q.accommodation_description && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{q.accommodation_description}</p>
            )}
          </section>
        )}

        {q.accommodation_services && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-2xl font-semibold">Servicios incluidos</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{q.accommodation_services}</p>
          </section>
        )}

        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="font-display text-2xl font-semibold">Inversión</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {q.price_per_night != null && (
              <Line label="Precio por noche" value={`${q.currency} ${Number(q.price_per_night).toLocaleString()}`} />
            )}
            {q.taxes != null && (
              <Line label="Impuestos" value={`${q.currency} ${Number(q.taxes).toLocaleString()}`} />
            )}
            <div className="mt-3 flex items-baseline justify-between border-t border-primary/20 pt-3">
              <span className="font-display text-lg font-semibold">Total</span>
              <span className="font-display text-2xl font-semibold text-primary">
                {q.currency} {Number(q.total_amount ?? 0).toLocaleString()}
              </span>
            </div>
          </dl>
        </section>

        {q.cancellation_policy && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold">Política de cancelación</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {q.cancellation_policy}
            </p>
          </section>
        )}

        {q.notes && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold">Observaciones</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{q.notes}</p>
          </section>
        )}

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          {company.footerText ?? `Cotización generada con ${company.companyName ?? "ViaE Sales Hub"}`} ·{" "}
          {new Date(q.created_at).toLocaleDateString()}
        </footer>
      </main>
    </div>
    </>
  );

}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: unknown }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-lg font-medium">{value == null || value === "" ? "—" : String(value)}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
