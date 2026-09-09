import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Compass,
  Download,
  Loader2,
  MapPin,
  MessageCircle,
  Moon,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/currency";
import {
  clientCanRespondSmartQuote,
  getPublicSmartQuote,
  respondPublicSmartQuote,
} from "@/lib/public-smart-quote.functions";

/** Número de WhatsApp en formato wa.me (solo dígitos). */
function whatsappDigits(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

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
  const respondFn = useServerFn(respondPublicSmartQuote);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [answer, setAnswer] = useState<"accepted" | "rejected" | null>(null);
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

  const waDigits = whatsappDigits(branding.whatsapp);
  const whatsappHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`Hola! Te escribo por la propuesta "${q.title}".`)}`
    : null;
  const contactHref = whatsappHref ?? (branding.email ? `mailto:${branding.email}` : null);

  // Respuesta del cliente desde el enlace público (una sola vez).
  const respondedStatus =
    answer ??
    (q.status === "accepted" ? "accepted" : q.status === "rejected" ? "rejected" : null);
  const canRespond = respondedStatus === null && clientCanRespondSmartQuote(q.status);

  async function respond(action: "accept" | "reject") {
    setBusy(action);
    try {
      const res = await respondFn({
        data: { token, action, note: note.trim() ? note.trim() : undefined },
      });
      setAnswer(res.status);
      toast.success(
        res.status === "accepted"
          ? "¡Gracias! Confirmamos tu propuesta."
          : "Registramos tu respuesta.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la respuesta");
    } finally {
      setBusy(null);
    }
  }

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

        <section
          className="rounded-2xl border bg-card p-6 shadow-sm"
          style={{ borderColor: `${branding.accentColor}66` }}
        >
          {respondedStatus ? (
            <div className="flex items-start gap-3">
              {respondedStatus === "accepted" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: branding.primaryColor }} />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
              )}
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {respondedStatus === "accepted" ? "Propuesta aceptada" : "Propuesta rechazada"}
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
          ) : canRespond ? (
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
                  style={{ background: branding.primaryColor }}
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
                {contactHref && (
                  <a href={contactHref} target="_blank" rel="noreferrer">
                    <Button variant="ghost" className="w-full sm:w-auto">
                      <MessageCircle className="mr-2 h-4 w-4" /> Contactar agente
                    </Button>
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                ¿Tenés dudas sobre esta propuesta? Escribile a tu agente.
              </p>
              {contactHref && (
                <a href={contactHref} target="_blank" rel="noreferrer">
                  <Button size="sm" style={{ background: branding.primaryColor }}>
                    <MessageCircle className="mr-2 h-4 w-4" /> Contactar agente
                  </Button>
                </a>
              )}
            </div>
          )}
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
