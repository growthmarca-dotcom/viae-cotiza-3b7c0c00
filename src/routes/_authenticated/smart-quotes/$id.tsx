import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
  Target,
  TicketCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SmartQuoteHeaderForm } from "@/components/smart-quote-header-form";
import { SmartQuoteItemsPanel } from "@/components/smart-quote-items-panel";
import { SmartQuoteSharePanel } from "@/components/smart-quote-share-panel";
import { SmartQuoteVersionsPanel } from "@/components/smart-quote-versions-panel";
import { useAccount } from "@/hooks/use-account";
import { formatMoney } from "@/lib/currency";
import { currentAgentId } from "@/lib/pipeline";
import {
  SMART_QUOTE_SOURCE_LABELS,
  SMART_QUOTE_STATUS_LABELS,
  allowedSmartQuoteTransitions,
  createQuotationFromSmartQuote,
  getSmartQuote,
  listQuotationsBySmartQuote,
  listSmartQuoteItems,
  smartQuoteAgentLabel,
  smartQuoteClientLabel,
  smartQuotePassengersLabel,
  smartQuoteStatusClasses,
  updateSmartQuoteStatus,
  type SmartQuoteItemRow,
  type SmartQuoteListRow,
  type SmartQuoteStatus,
} from "@/lib/smartQuotes";

export const Route = createFileRoute("/_authenticated/smart-quotes/$id")({
  component: SmartQuoteDetailPage,
  head: () => ({
    meta: [
      { title: "Detalle de cotización inteligente — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Constructor manual de ítems, ciclo de vida comercial y generación de propuesta al cliente.",
      },
      { property: "og:title", content: "Detalle de cotización inteligente — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Ítems, estado comercial y propuestas generadas desde la cotización inteligente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type QuotationRef = Awaited<ReturnType<typeof listQuotationsBySmartQuote>>[number];

function SmartQuoteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin, isOperations } = useAccount();
  const [quote, setQuote] = useState<SmartQuoteListRow | null>(null);
  const [items, setItems] = useState<SmartQuoteItemRow[]>([]);
  const [quotations, setQuotations] = useState<QuotationRef[]>([]);
  const [myAgentId, setMyAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sq = await getSmartQuote(id);
      setQuote(sq);
      if (!sq) return;
      const [its, qs, agentId] = await Promise.all([
        listSmartQuoteItems(id),
        listQuotationsBySmartQuote(id).catch(() => []),
        currentAgentId(),
      ]);
      setItems(its);
      setQuotations(qs);
      setMyAgentId(agentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la cotización");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando cotización inteligente...
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          La cotización inteligente no existe o no tenés permisos para verla.
        </p>
        <Button asChild variant="outline">
          <Link to="/smart-quotes">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
          </Link>
        </Button>
      </div>
    );
  }

  // Admin y Operaciones gestionan todo; el agente gestiona las propias/asignadas.
  const editable =
    isAdmin || isOperations || (!!myAgentId && quote.agent_id === myAgentId);
  const transitions = allowedSmartQuoteTransitions(quote.status);

  async function changeStatus(next: string) {
    setBusy(true);
    try {
      await updateSmartQuoteStatus(quote!.id, next as SmartQuoteStatus);
      toast.success("Estado actualizado");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    } finally {
      setBusy(false);
    }
  }

  async function generateQuotation() {
    setBusy(true);
    try {
      const quotationId = await createQuotationFromSmartQuote(quote!.id);
      toast.success("Propuesta generada");
      navigate({ to: "/quotations/$id", params: { id: quotationId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar la propuesta");
    } finally {
      setBusy(false);
    }
  }

  const destination =
    [quote.destination_city, quote.destination_state, quote.destination_country]
      .filter(Boolean)
      .join(", ") || "—";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/smart-quotes">
          <ArrowLeft className="mr-2 h-4 w-4" /> Cotizaciones inteligentes
        </Link>
      </Button>

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-2xl font-semibold sm:text-3xl">
            <Sparkles className="h-5 w-5 shrink-0 text-gold" />
            <span className="truncate">{quote.title}</span>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${smartQuoteStatusClasses(quote.status)}`}
            >
              {SMART_QUOTE_STATUS_LABELS[quote.status]}
            </span>
            <span>{SMART_QUOTE_SOURCE_LABELS[quote.source]}</span>
          </p>
        </div>
      </header>

      {!editable && (
        <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
          Modo lectura: no sos administrador, operaciones ni el agente asignado de esta cotización.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Contexto comercial</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente">{smartQuoteClientLabel(quote)}</Field>
            <Field label="Agente">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" /> {smartQuoteAgentLabel(quote)}
              </span>
            </Field>
            <Field label="Oportunidad">
              {quote.opportunities ? (
                <Link
                  to="/opportunities/$id"
                  params={{ id: quote.opportunities.id }}
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                >
                  <Target className="h-3.5 w-3.5" /> {quote.opportunities.title}
                </Link>
              ) : (
                "Sin oportunidad"
              )}
            </Field>
            <Field label="Destino">{destination}</Field>
            <Field label="Fechas">
              {quote.start_date
                ? `${new Date(quote.start_date).toLocaleDateString()} → ${
                    quote.end_date ? new Date(quote.end_date).toLocaleDateString() : "—"
                  }`
                : "—"}
            </Field>
            <Field label="Pasajeros">{smartQuotePassengersLabel(quote.passengers_metadata)}</Field>
            <Field label="Monto">
              {quote.total_amount == null
                ? "—"
                : formatMoney(quote.currency, Number(quote.total_amount))}
            </Field>
            <Field label="Creada">{new Date(quote.created_at).toLocaleDateString()}</Field>
          </dl>

          {editable && (
            <div className="max-w-sm">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Cambiar estado
              </p>
              {transitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Estado final: no admite más transiciones.
                </p>
              ) : (
                <Select value="" onValueChange={changeStatus} disabled={busy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí el próximo estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {transitions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SMART_QUOTE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </section>

        <div className="lg:col-span-1">
          <SmartQuoteSharePanel quote={quote} editable={editable} onChanged={load} />
        </div>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Propuestas al cliente</h2>
          {quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no generaste la propuesta con PDF y enlace público.
            </p>
          ) : (
            <ul className="space-y-2">
              {quotations.map((q) => (
                <li key={q.id} className="rounded-xl border border-border bg-background p-3">
                  <p className="truncate text-sm font-medium">{q.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(q.currency || "USD", Number(q.total_amount ?? 0))}
                    {q.status ? ` · ${q.status}` : ""}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                    <Link to="/quotations/$id" params={{ id: q.id }}>
                      <FileText className="mr-2 h-4 w-4" /> Abrir propuesta
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Button
            size="sm"
            className="w-full"
            disabled={!editable || busy || items.length === 0}
            onClick={generateQuotation}
          >
            <TicketCheck className="mr-2 h-4 w-4" /> Generar propuesta
          </Button>
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Cargá al menos un ítem antes de generar la propuesta.
            </p>
          )}
        </section>

        <div className="lg:col-span-3">
          <SmartQuoteHeaderForm quote={quote} editable={editable} onSaved={load} />
        </div>

        <div className="lg:col-span-3">
          <SmartQuoteItemsPanel
            smartQuoteId={quote.id}
            currency={quote.currency}
            items={items}
            editable={editable}
            onChanged={load}
          />
        </div>

        <div className="lg:col-span-3">
          <SmartQuoteVersionsPanel
            smartQuoteId={quote.id}
            refreshKey={`${quote.updated_at}-${items.length}-${quote.total_amount ?? 0}`}
            fallbackCurrency={quote.currency}
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
