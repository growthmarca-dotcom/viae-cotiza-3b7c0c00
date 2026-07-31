import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentFormDialog } from "@/components/agent-form-dialog";
import { useAccount } from "@/hooks/use-account";
import { formatMoney } from "@/lib/currency";
import { stageClasses, stageLabel, type Opportunity } from "@/lib/opportunities";
import {
  AGENT_STATUSES,
  agentFullName,
  agentStatusClasses,
  agentStatusLabel,
  agentToInput,
  computeAgentStats,
  getAgent,
  listOpportunitiesByAgent,
  setAgentStatus,
  updateAgent,
  type Agent,
  type AgentInput,
  type AgentStatus,
} from "@/lib/agents";

export const Route = createFileRoute("/_authenticated/agents_/$id")({
  component: AgentDetailPage,
  head: () => ({
    meta: [
      { title: "Ficha de agente — ViaE Sales Hub" },
      {
        name: "description",
        content: "Panel del agente: clientes, oportunidades, cotizaciones y estadísticas.",
      },
      { property: "og:title", content: "Ficha de agente — ViaE Sales Hub" },
      { property: "og:description", content: "Panel comercial y estadísticas del agente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ClientRow = { id: string; full_name: string; last_name: string | null; email: string | null };
type QuotationRow = {
  id: string;
  title: string;
  status: string;
  currency: string;
  total_amount: number | null;
  created_at: string;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}

function AgentDetailPage() {
  const { id } = Route.useParams();
  const { isAdmin } = useAccount();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const a = await getAgent(id);
      setAgent(a);
      const opps = await listOpportunitiesByAgent(id);
      setOpportunities(opps);

      const clientIds = [...new Set(opps.map((o) => o.client_id).filter(Boolean))];
      if (clientIds.length) {
        const { data } = await supabase
          .from("clients")
          .select("id, full_name, last_name, email")
          .in("id", clientIds);
        setClients((data ?? []) as ClientRow[]);
      } else {
        setClients([]);
      }

      const quotationIds = [...new Set(opps.map((o) => o.quotation_id).filter(Boolean))] as string[];
      if (quotationIds.length) {
        const { data } = await supabase
          .from("quotations")
          .select("id, title, status, currency, total_amount, created_at")
          .in("id", quotationIds)
          .order("created_at", { ascending: false });
        setQuotations((data ?? []) as QuotationRow[]);
      } else {
        setQuotations([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el agente");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdate(input: AgentInput) {
    setSaving(true);
    try {
      await updateAgent(id, input);
      toast.success("Agente actualizado");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el agente");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(status: AgentStatus) {
    try {
      await setAgentStatus(id, status);
      toast.success(`Estado actualizado: ${agentStatusLabel(status)}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-8 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha del agente...
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center md:px-8">
        <p className="text-muted-foreground">No se encontró el agente solicitado.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/agents">Volver a Agentes</Link>
        </Button>
      </div>
    );
  }

  // Todas las estadísticas se expresan en la moneda de análisis configurada.
  const normalized = opportunities.map((o) => ({
    ...o,
    estimated_value: toAnalysisCurrency(o.estimated_value, o.currency, analysisCurrency, null) ?? 0,
    currency: analysisCurrency,
  }));
  const stats = computeAgentStats(normalized);
  const currency = analysisCurrency;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/agents">
          <ArrowLeft className="mr-2 h-4 w-4" /> Agentes
        </Link>
      </Button>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold">{agentFullName(agent)}</h1>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${agentStatusClasses(agent.status)}`}
              >
                {agentStatusLabel(agent.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[agent.company, agent.email, agent.whatsapp].filter(Boolean).join(" · ") ||
                "Sin datos de contacto"}
            </p>
            <p className="text-xs text-muted-foreground">
              {[agent.city, agent.state, agent.country].filter(Boolean).join(", ")} · Alta:{" "}
              {new Date(agent.created_at).toLocaleDateString()}
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={agent.status} onValueChange={(v) => handleStatus(v as AgentStatus)}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Idiomas</p>
            <p className="text-sm">{(agent.languages ?? []).join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Especialidades</p>
            <p className="text-sm">{(agent.specialties ?? []).join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Perfil comercial
            </p>
            <p className="text-sm">
              {agent.commission_type
                ? `${agent.commission_type === "percentage" ? "Porcentaje" : "Monto fijo"}: ${agent.commission_value ?? 0}${agent.commission_type === "percentage" ? "%" : ` ${agent.commission_currency}`}`
                : "Sin definir"}{" "}
              <span className="text-xs text-muted-foreground">(sin cálculo automático)</span>
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Acceso al sistema
            </p>
            <p className="text-sm">
              {agent.access_status === "linked"
                ? "Usuario vinculado"
                : agent.access_status === "invited"
                  ? `Invitación pendiente${agent.invited_email ? ` (${agent.invited_email})` : ""}`
                  : "Sin acceso"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              WhatsApp (preparado)
            </p>
            <p className="text-sm">
              {agent.wa_number || "Sin número"}
              {agent.wa_extension ? ` ext. ${agent.wa_extension}` : ""} · {agent.wa_status}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Motor de asignación (preparado)
            </p>
            <p className="text-sm">
              Zona: {agent.main_zone || "—"} · Prioridad: {agent.priority} · Máx. clientes:{" "}
              {agent.max_active_clients ?? "—"} · Máx. oportunidades:{" "}
              {agent.max_open_opportunities ?? "—"} ·{" "}
              {agent.auto_receive_leads ? "Recibe leads" : "No recibe leads"} ·{" "}
              {agent.available_for_assignment ? "Disponible" : "No disponible"}
            </p>
          </div>
          {agent.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Observaciones</p>
              <p className="whitespace-pre-line text-sm">{agent.notes}</p>
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Estadísticas</h2>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
        <Stat label="Clientes asignados" value={stats.clients} />
        <Stat label="Oportunidades activas" value={stats.activeOpportunities} />
        <Stat label="Cotizaciones enviadas" value={stats.quotationsSent} />
        <Stat label="Reservas confirmadas" value={stats.bookings} />
        <Stat label="Ventas perdidas" value={stats.lost} />
        <Stat label="Conversión" value={`${stats.conversion}%`} />
        <Stat label="Valor estimado" value={formatMoney(currency, stats.estimatedValue)} />
        <Stat label="Valor vendido" value={formatMoney(currency, stats.soldValue)} />
        <Stat label="Ticket promedio" value={formatMoney(currency, stats.averageTicket)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-3 font-display text-xl font-semibold">Oportunidades asignadas</h2>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay oportunidades asignadas a este agente.
            </p>
          ) : (
            <ul className="space-y-3">
              {opportunities.map((o) => (
                <li key={o.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(o.currency, o.estimated_value)} · Asignada el{" "}
                        {o.assigned_at ? new Date(o.assigned_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${stageClasses(o.stage)}`}
                    >
                      {stageLabel(o.stage)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-3 font-display text-xl font-semibold">Clientes asignados</h2>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin clientes asignados.</p>
          ) : (
            <ul className="space-y-2">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/clients/$id"
                    params={{ id: c.id }}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-gold/50"
                  >
                    <span className="truncate">
                      {[c.full_name, c.last_name].filter(Boolean).join(" ")}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{c.email ?? ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-3 mt-6 font-display text-xl font-semibold">Cotizaciones</h2>
          {quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cotizaciones asociadas.</p>
          ) : (
            <ul className="space-y-2">
              {quotations.map((q) => (
                <li key={q.id}>
                  <Link
                    to="/quotations/$id"
                    params={{ id: q.id }}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-gold/50"
                  >
                    <span className="truncate">{q.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatMoney(q.currency, q.total_amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AgentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={agentToInput(agent)}
        title="Editar agente"
        submitLabel="Guardar cambios"
        submitting={saving}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
