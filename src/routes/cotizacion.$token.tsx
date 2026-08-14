import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Compass, Download, Loader2, MapPin, Calendar, Users, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicQuotation } from "@/lib/public-quotation.functions";
import { QuotationPrintDocument } from "@/components/quotation-print";
import { convertTotals, formatMoney } from "@/lib/currency";
import {
  CATEGORY_LABELS,
  QUOTATION_ITEM_CATEGORIES,
  type QuotationItemCategory,
} from "@/lib/quotationItems";



export const Route = createFileRoute("/cotizacion/$token")({
  component: PublicQuotationPage,
  head: () => ({
    meta: [
      { title: "Tu cotización de viaje" },
      { name: "description", content: "Detalle de tu propuesta de viaje." },
      { property: "og:title", content: "Tu cotización de viaje" },
      { property: "og:description", content: "Detalle de tu propuesta de viaje." },
      // Cotización privada compartida por enlace: no debe indexarse.
      { name: "robots", content: "noindex, nofollow" },
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
  const totals = convertTotals(q.total_amount, q.currency, q.exchange_rate);
  const items = data.items ?? [];
  const itemAmount = (i: (typeof items)[number]) =>
    Number(i.quantity ?? 1) * Number(i.unit_amount ?? 0) + Number(i.taxes ?? 0);
  const groups = QUOTATION_ITEM_CATEGORIES.map((c) => ({
    category: c.value as QuotationItemCategory,
    label: c.label,
    list: items.filter((i) => i.category === c.value),
  })).filter((g) => g.list.length > 0);
  const itemDetail = (i: (typeof items)[number]) =>
    [
      i.service_date && i.end_date
        ? `${i.service_date} → ${i.end_date}`
        : (i.service_date ?? i.end_date),
      i.time_label,
      i.origin && i.destination ? `${i.origin} → ${i.destination}` : (i.origin ?? i.destination),
      i.pax_count != null ? `${i.pax_count} pax` : null,
      i.quantity != null && Number(i.quantity) > 1 ? `x${Number(i.quantity)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const contactLines = [company.whatsapp, company.email, company.website, company.address].filter(
    Boolean,
  ) as string[];
  const socialLines = [
    company.instagram && `Instagram: ${company.instagram}`,
    company.facebook && `Facebook: ${company.facebook}`,
    company.tiktok && `TikTok: ${company.tiktok}`,
    company.linkedin && `LinkedIn: ${company.linkedin}`,
  ].filter(Boolean) as string[];

  return (
    <>
    <QuotationPrintDocument quotation={q} company={company} imageUrls={urls} />
    <div
      className="min-h-screen bg-background print-screen-hide"
      style={
        {
          "--brand-primary": company.primaryColor,
          "--brand-accent": company.accentColor,
        } as React.CSSProperties
      }
    >
      <header
        data-print-hide
        className="border-b bg-card"
        style={{ borderBottomColor: company.accentColor }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-6 py-4">
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.companyName ?? "Logo"}
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <div
                className="grid h-9 w-9 place-items-center rounded-lg text-white"
                style={{ background: company.primaryColor }}
              >
                <Compass className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              {company.companyName ? (
                <span
                  className="block truncate font-display text-lg font-semibold tracking-tight"
                  style={{ color: company.primaryColor }}
                >
                  {company.companyName}
                </span>
              ) : null}
              {company.address ? (
                <span className="block truncate text-xs text-muted-foreground">{company.address}</span>
              ) : null}
            </div>
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

        {groups.map((g) => (
          <section
            key={g.category}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <h2 className="font-display text-2xl font-semibold">{g.label}</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {g.list.map((i, idx) => (
                <li
                  key={`${g.category}-${idx}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{i.title || CATEGORY_LABELS[g.category]}</p>
                    {itemDetail(i) && (
                      <p className="text-xs text-muted-foreground">{itemDetail(i)}</p>
                    )}
                    {i.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {i.description}
                      </p>
                    )}
                    {i.notes && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                        {i.notes}
                      </p>
                    )}
                  </div>
                  <span className="font-medium">
                    {formatMoney(q.currency, itemAmount(i))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section
          className="rounded-2xl border p-6"
          style={{ borderColor: `${company.accentColor}66`, background: `${company.primaryColor}0D` }}
        >
          <h2 className="font-display text-2xl font-semibold" style={{ color: company.primaryColor }}>
            Inversión
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            {q.price_per_night != null && (
              <Line label="Precio por noche" value={`${q.currency} ${Number(q.price_per_night).toLocaleString()}`} />
            )}
            {q.taxes != null && (
              <Line label="Impuestos" value={`${q.currency} ${Number(q.taxes).toLocaleString()}`} />
            )}
            {q.other_charges != null && (
              <Line label="Otros cargos" value={`${q.currency} ${Number(q.other_charges).toLocaleString()}`} />
            )}
            {groups.map((g) => (
              <Line
                key={`sub-${g.category}`}
                label={g.label}
                value={formatMoney(
                  q.currency,
                  g.list.reduce((a, i) => a + itemAmount(i), 0),
                )}
              />
            ))}
            <div
              className="mt-3 flex items-baseline justify-between border-t pt-3"
              style={{ borderTopColor: `${company.accentColor}66` }}
            >
              <span className="font-display text-lg font-semibold">Total</span>
              <span className="font-display text-2xl font-semibold" style={{ color: company.primaryColor }}>
                {q.currency} {Number(q.total_amount ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 space-y-2 border-t pt-3" style={{ borderTopColor: `${company.accentColor}33` }}>
              <Line label="Moneda utilizada" value={q.currency} />
              <Line
                label="Tipo de cambio utilizado"
                value={totals.rate != null ? `1 USD = ARS ${totals.rate.toLocaleString("es-AR")}` : "—"}
              />
              <Line
                label="Total en USD"
                value={totals.totalUsd != null ? formatMoney("USD", totals.totalUsd) : "—"}
              />
              <Line
                label="Total en ARS"
                value={totals.totalArs != null ? formatMoney("ARS", totals.totalArs) : "—"}
              />
              <Line
                label="Fecha de la cotización"
                value={new Date(q.created_at).toLocaleDateString()}
              />
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

        <footer
          className="mt-4 space-y-2 border-t pt-6 text-center text-xs text-muted-foreground"
          style={{ borderTopColor: `${company.accentColor}66` }}
        >
          {company.companyName ? (
            <div className="font-medium" style={{ color: company.primaryColor }}>
              {company.companyName}
            </div>
          ) : null}
          {contactLines.length > 0 && <div>{contactLines.join(" · ")}</div>}
          {socialLines.length > 0 && <div>{socialLines.join(" · ")}</div>}
          <div>
            {company.footerText ?? "Cotización sin valor contractual."} ·{" "}
            {new Date(q.created_at).toLocaleDateString()}
          </div>
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
