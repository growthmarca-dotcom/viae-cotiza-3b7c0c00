import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  Copy,
  Download,
  Link2,
  Loader2,
  MapPin,
  Calendar,
  Users,
  Moon,
  MessageCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  clientCanRespond,
  getPublicQuotation,
  respondPublicQuotation,
} from "@/lib/public-quotation.functions";
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

/** Número de WhatsApp en formato wa.me (solo dígitos, sin + ni separadores). */
function whatsappDigits(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/** URL absoluta de la web configurada (acepta valores sin protocolo). */
function websiteHref(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function PublicQuotationPage() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(getPublicQuotation);
  const respondFn = useServerFn(respondPublicQuotation);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [answer, setAnswer] = useState<"accepted" | "rejected" | null>(null);
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
  // Enlace de esta cotización (dinámico, incluye el número/token de la cotización).
  const quotationUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/cotizacion/${token}`
      : `/cotizacion/${token}`;

  const agentPhone = whatsappDigits(company.whatsapp);
  const whatsappMessage = [
    `Hola${company.companyName ? ` ${company.companyName}` : ""}, te escribo por la cotización "${q.title}"`,
    q.destination ? ` a ${q.destination}` : "",
    `. Enlace: ${quotationUrl}`,
  ].join("");
  const whatsappHref = agentPhone
    ? `https://wa.me/${agentPhone}?text=${encodeURIComponent(whatsappMessage)}`
    : null;
  const siteHref = websiteHref(company.website);

  // Respuesta del cliente desde el enlace público (una sola vez).
  const respondedStatus =
    answer ??
    (q.client_responded_at || q.status === "accepted" || q.status === "rejected"
      ? q.status === "accepted"
        ? "accepted"
        : q.status === "rejected"
          ? "rejected"
          : null
      : null);
  const canRespond = respondedStatus === null && clientCanRespond(q.status);

  async function respond(action: "accept" | "reject") {
    setBusy(action);
    try {
      const res = await respondFn({
        data: { token, action, note: note.trim() ? note.trim() : undefined },
      });
      setAnswer(res.status);
      toast.success(
        res.status === "accepted" ? "¡Gracias! Confirmamos tu propuesta." : "Registramos tu respuesta.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la respuesta");
    } finally {
      setBusy(null);
    }
  }

  async function copyQuotationUrl() {
    try {
      await navigator.clipboard.writeText(quotationUrl);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  const socialLines = [
    company.instagram && `Instagram: ${company.instagram}`,
    company.facebook && `Facebook: ${company.facebook}`,
    company.tiktok && `TikTok: ${company.tiktok}`,
    company.linkedin && `LinkedIn: ${company.linkedin}`,
  ].filter(Boolean) as string[];

  return (
    <>
    <QuotationPrintDocument quotation={q} company={company} imageUrls={urls} items={items} />
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
          <div className="flex shrink-0 items-center gap-2">
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <Button size="sm" style={{ background: company.primaryColor }}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Contactar agente
                </Button>
              </a>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="mr-2 h-4 w-4" /> Descargar PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10 pb-24">
        <section>
          {guestName && (
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Propuesta para {guestName}</p>
          )}
          {q.quotation_number && (
            <p className="mt-1 text-sm font-medium tracking-wide text-primary">
              Cotización {q.quotation_number}
            </p>
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

        {(canRespond || respondedStatus) && (
          <section
            data-print-hide
            className="rounded-2xl border bg-card p-6 shadow-sm"
            style={{ borderColor: `${company.accentColor}66` }}
          >
            {respondedStatus ? (
              <div className="flex items-start gap-3">
                {respondedStatus === "accepted" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: company.primaryColor }} />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    {respondedStatus === "accepted"
                      ? "Propuesta aceptada"
                      : "Propuesta rechazada"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {respondedStatus === "accepted"
                      ? "Tu agente ya recibió la confirmación y se pondrá en contacto para los próximos pasos."
                      : "Registramos tu respuesta. Si querés otra alternativa, escribile a tu agente."}
                  </p>
                  {q.client_response_note && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">“{q.client_response_note}”</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl font-semibold">¿Confirmás esta propuesta?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Podés aceptarla o rechazarla desde acá. Tu agente recibirá la respuesta al instante.
                </p>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Comentario para tu agente (opcional)"
                  rows={3}
                  maxLength={1000}
                  className="mt-4"
                />
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    disabled={busy !== null}
                    onClick={() => respond("accept")}
                    style={{ background: company.primaryColor }}
                  >
                    {busy === "accept" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Aceptar propuesta
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => respond("reject")}
                    className="text-destructive hover:text-destructive"
                  >
                    {busy === "reject" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Rechazar
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        <section
          data-print-hide
          className="rounded-2xl border bg-card p-5 shadow-sm"
          style={{ borderColor: `${company.accentColor}66` }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div
                className="flex items-center gap-2 font-display text-lg font-semibold"
                style={{ color: company.primaryColor }}
              >
                <Link2 className="h-4 w-4" /> Enlace de esta cotización
              </div>
              <a
                href={quotationUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {quotationUrl}
              </a>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={copyQuotationUrl}>
                <Copy className="mr-2 h-4 w-4" /> Copiar enlace
              </Button>
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <Button size="sm" style={{ background: company.primaryColor }}>
                    <MessageCircle className="mr-2 h-4 w-4" /> Contactar agente
                  </Button>
                </a>
              )}
            </div>
          </div>
        </section>

        <footer
          className="mt-4 space-y-2 border-t pt-6 text-center text-xs text-muted-foreground"
          style={{ borderTopColor: `${company.accentColor}66` }}
        >
          {company.companyName ? (
            <div className="font-medium" style={{ color: company.primaryColor }}>
              {company.companyName}
            </div>
          ) : null}
          {contactLines.length > 0 && (
            <div>
              {contactLines.map((line, i) => (
                <span key={`${line}-${i}`}>
                  {i > 0 ? " · " : ""}
                  {siteHref && line === company.website ? (
                    <a
                      href={siteHref}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-4 hover:underline"
                      style={{ color: company.primaryColor }}
                    >
                      {line}
                    </a>
                  ) : (
                    line
                  )}
                </span>
              ))}
            </div>
          )}
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
