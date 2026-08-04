import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  FileText,
  History,
  Loader2,
  PencilLine,
  Sparkles,
  Target,
  TicketCheck,
  UserRound,
  Users,
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
import { BookingCreateDialog } from "@/components/booking-create-dialog";
import { OpportunityTrackingDialog } from "@/components/opportunity-tracking-dialog";
import { SmartQuoteCreateDialog } from "@/components/smart-quote-create-dialog";
import { useAccount } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { agentFullName, getAgent, type Agent } from "@/lib/agents";
import { getBookingByOpportunity, type Booking } from "@/lib/bookings";
import { getClient, type Client } from "@/lib/clients";
import { formatMoney } from "@/lib/currency";
import {
  SMART_QUOTE_STATUS_LABELS,
  listSmartQuotesByOpportunity,
  type SmartQuote,
} from "@/lib/smartQuotes";
import {
  listOpportunityHistory,
  listStageConfig,
  moveOpportunityStage,
  sourceLabel,
  stageClasses,
  type Opportunity,
  type OpportunityHistoryRow,
  type OpportunityStage,
  type StageConfig,
} from "@/lib/opportunities";
import {
  canEditOpportunity,
  currentAgentId,
  daysInStageLabel,
  getOpportunity,
  resolveStages,
} from "@/lib/pipeline";

export const Route = createFileRoute("/_authenticated/opportunities_/$id")({
  component: OpportunityDetailPage,
  head: () => ({
    meta: [
      { title: "Detalle de oportunidad — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Ficha comercial de la oportunidad: etapa, seguimiento, historial y relaciones con cotización y reserva.",
      },
      { property: "og:title", content: "Detalle de oportunidad — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Seguimiento comercial, historial de etapas y relaciones de la oportunidad.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type QuotationRef = {
  id: string;
  title: string | null;
  status: string | null;
  total_amount: number | null;
  currency: string | null;
};

function OpportunityDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin, account } = useAccount();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [quotation, setQuotation] = useState<QuotationRef | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [history, setHistory] = useState<OpportunityHistoryRow[]>([]);
  const [stageConfig, setStageConfig] = useState<StageConfig[]>([]);
  const [myAgentId, setMyAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [smartQuotes, setSmartQuotes] = useState<SmartQuote[]>([]);
  const [smartQuoteOpen, setSmartQuoteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await getOpportunity(id);
      setOpportunity(o);
      if (!o) {
        toast.error("Oportunidad no encontrada o sin acceso");
        return;
      }
      const [cfg, hist, agentId, bk, sqs] = await Promise.all([
        listStageConfig(),
        listOpportunityHistory(id).catch(() => []),
        currentAgentId(),
        getBookingByOpportunity(id).catch(() => null),
        listSmartQuotesByOpportunity(id).catch(() => []),
      ]);
      setStageConfig(cfg);
      setHistory(hist);
      setMyAgentId(agentId);
      setBooking(bk);
      setSmartQuotes(sqs);

      setClient(o.client_id ? await getClient(o.client_id).catch(() => null) : null);
      setAgent(o.assigned_agent_id ? await getAgent(o.assigned_agent_id).catch(() => null) : null);

      if (o.quotation_id) {
        const { data } = await supabase
          .from("quotations")
          .select("id, title, status, total_amount, currency")
          .eq("id", o.quotation_id)
          .maybeSingle();
        setQuotation((data as QuotationRef) ?? null);
      } else {
        setQuotation(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la oportunidad");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const stages = useMemo(() => resolveStages(stageConfig), [stageConfig]);
  const stageLabelOf = useCallback(
    (value: string | null) =>
      value ? (stages.find((s) => s.stage === value)?.label ?? value) : "—",
    [stages],
  );

  const editable = opportunity
    ? canEditOpportunity({
        opportunity,
        isAdmin,
        userId: account?.userId ?? null,
        agentId: myAgentId,
      })
    : false;

  async function move(stage: string) {
    if (!opportunity || stage === opportunity.stage) return;
    setMoving(true);
    try {
      await moveOpportunityStage({ id: opportunity.id, stage: stage as OpportunityStage });
      toast.success("Etapa actualizada");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la etapa");
    } finally {
      setMoving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando oportunidad...
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          La oportunidad no existe o no tenés permisos para verla.
        </p>
        <Button asChild variant="outline">
          <Link to="/opportunities">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al pipeline
          </Link>
        </Button>
      </div>
    );
  }

  const clientLabel = client
    ? [client.full_name, client.last_name].filter(Boolean).join(" ") || "Cliente"
    : "Sin cliente";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/opportunities">
          <ArrowLeft className="mr-2 h-4 w-4" /> Pipeline comercial
        </Link>
      </Button>

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-2xl font-semibold sm:text-3xl">
            <Target className="h-5 w-5 shrink-0 text-gold" />
            <span className="truncate">{opportunity.title}</span>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${stageClasses(opportunity.stage)}`}
            >
              {stageLabelOf(opportunity.stage)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {daysInStageLabel(opportunity)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!editable}
            onClick={() => setTrackingOpen(true)}
          >
            <PencilLine className="mr-2 h-4 w-4" /> Editar seguimiento
          </Button>
        </div>
      </header>

      {!editable && (
        <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
          Modo lectura: no sos administrador ni el responsable/agente asignado de esta oportunidad.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Información comercial</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              {client ? (
                <Link
                  to="/clients/$id"
                  params={{ id: client.id }}
                  className="font-medium hover:underline"
                >
                  {clientLabel}
                </Link>
              ) : (
                clientLabel
              )}
            </Field>
            <Field label="Valor estimado">
              {formatMoney(opportunity.currency, Number(opportunity.estimated_value ?? 0))}
            </Field>
            <Field label="Moneda">{opportunity.currency}</Field>
            <Field label="Probabilidad">{opportunity.probability ?? 0}%</Field>
            <Field label="Responsable">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" />
                {agent ? agentFullName(agent) : "Sin agente asignado"}
              </span>
            </Field>
            <Field label="Origen">{sourceLabel(opportunity.lead_source)}</Field>
            <Field label="Creada">
              {new Date(opportunity.created_at).toLocaleDateString()}
            </Field>
            <Field label="Etapa desde">
              {opportunity.stage_changed_at
                ? new Date(opportunity.stage_changed_at).toLocaleDateString()
                : "—"}
            </Field>
            <Field label="Cierre estimado">
              {opportunity.expected_close_date
                ? new Date(opportunity.expected_close_date).toLocaleDateString()
                : "—"}
            </Field>
            {opportunity.lost_reason && (
              <Field label="Motivo de pérdida">{opportunity.lost_reason}</Field>
            )}
          </dl>

          <div className="max-w-sm">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              Cambiar etapa
            </p>
            <Select value={opportunity.stage} onValueChange={move} disabled={!editable || moving}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.stage} value={s.stage}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Seguimiento</h2>
          <dl className="space-y-3">
            <Field label="Próxima acción">{opportunity.next_action || "Sin definir"}</Field>
            <Field label="Fecha de contacto">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {opportunity.next_contact_date
                  ? new Date(opportunity.next_contact_date).toLocaleDateString()
                  : "—"}
              </span>
            </Field>
            <Field label="Notas">
              <span className="whitespace-pre-wrap">{opportunity.notes || "Sin notas"}</span>
            </Field>
          </dl>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <History className="h-4 w-4 text-gold" /> Historial de etapas
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay cambios registrados.</p>
          ) : (
            <ol className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="rounded-xl border border-border bg-background p-3">
                  <p className="text-sm font-medium">
                    {h.from_stage ? `${stageLabelOf(h.from_stage)} → ` : "Alta en "}
                    {stageLabelOf(h.to_stage)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(h.changed_at).toLocaleString()}
                    {h.changed_by ? " · usuario del sistema" : " · automático"}
                    {h.notes ? ` · ${h.notes}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Relaciones y acciones</h2>

          {/* v1.10.9.2 — Smart Quotes de la oportunidad (motor comercial). */}
          {smartQuotes.length > 0 ? (
            <div className="space-y-2">
              {smartQuotes.map((sq) => (
                <div key={sq.id} className="rounded-xl border border-border bg-background p-3">
                  <p className="truncate text-sm font-medium">{sq.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {SMART_QUOTE_STATUS_LABELS[sq.status]}
                    {sq.total_amount != null
                      ? ` · ${formatMoney(sq.currency, Number(sq.total_amount))}`
                      : ""}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                    <Link to="/smart-quotes/$id" params={{ id: sq.id }}>
                      <Sparkles className="mr-2 h-4 w-4" /> Abrir Smart Quote
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={!editable}
            onClick={() => setSmartQuoteOpen(true)}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Crear Smart Quote
          </Button>

          {quotation ? (
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-sm font-medium">{quotation.title || "Cotización"}</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(quotation.currency || "USD", Number(quotation.total_amount ?? 0))}
                {quotation.status ? ` · ${quotation.status}` : ""}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                <Link to="/quotations/$id" params={{ id: quotation.id }}>
                  <FileText className="mr-2 h-4 w-4" /> Abrir cotización
                </Link>
              </Button>
            </div>
          ) : (
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/quotations/new">
                <FileText className="mr-2 h-4 w-4" /> Crear cotización
              </Link>
            </Button>
          )}

          {client && (
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/clients/$id" params={{ id: client.id }}>
                <Users className="mr-2 h-4 w-4" /> Abrir cliente
              </Link>
            </Button>
          )}

          {booking ? (
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/bookings/$id" params={{ id: booking.id }}>
                <TicketCheck className="mr-2 h-4 w-4" /> {booking.booking_number}
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!editable}
              onClick={() => setBookingOpen(true)}
            >
              <TicketCheck className="mr-2 h-4 w-4" /> Convertir a reserva
            </Button>
          )}
        </section>
      </div>

      <OpportunityTrackingDialog
        opportunity={opportunity}
        open={trackingOpen}
        onOpenChange={setTrackingOpen}
        onSaved={load}
      />

      <BookingCreateDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        origin={{ opportunityId: opportunity.id, quotationId: opportunity.quotation_id ?? null }}
        defaults={{
          clientId: opportunity.client_id,
          agentId: opportunity.assigned_agent_id,
          amount: Number(opportunity.estimated_value ?? 0),
          currency: opportunity.currency,
        }}
        onCreated={(bookingId) => navigate({ to: "/bookings/$id", params: { id: bookingId } })}
      />
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
