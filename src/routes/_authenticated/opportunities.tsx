import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Loader2, Search, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OpportunityKanban } from "@/components/opportunity-kanban";
import { OpportunityCreateDialog } from "@/components/opportunity-create-dialog";
import { OpportunityTrackingDialog } from "@/components/opportunity-tracking-dialog";

import { useAccount } from "@/hooks/use-account";
import { agentFullName, listAgents, type Agent } from "@/lib/agents";
import { listClients, type Client } from "@/lib/clients";
import { formatMoney } from "@/lib/currency";
import {
  LEAD_SOURCES,
  listOpportunities,
  listStageConfig,
  sourceLabel,
  stageClasses,
  type Opportunity,
  type StageConfig,
} from "@/lib/opportunities";
import {
  canEditOpportunity,
  currentAgentId,
  daysInStageLabel,
  resolveStages,
  sumByCurrency,
} from "@/lib/pipeline";

export const Route = createFileRoute("/_authenticated/opportunities")({
  component: OpportunitiesPage,
  head: () => ({
    meta: [
      { title: "Pipeline comercial — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Pipeline comercial Kanban: oportunidades por etapa, valor estimado, responsables y seguimiento.",
      },
      { property: "og:title", content: "Pipeline comercial — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Gestión transversal de oportunidades comerciales por etapa del pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL = "all";
const UNASSIGNED = "__none__";

function OpportunitiesPage() {
  const { isAdmin, account } = useAccount();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stageConfig, setStageConfig] = useState<StageConfig[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [myAgentId, setMyAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState(ALL);
  const [agentFilter, setAgentFilter] = useState(ALL);
  const [sourceFilter, setSourceFilter] = useState(ALL);
  const [tracking, setTracking] = useState<Opportunity | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [opps, cfg, cs, ags, agentId] = await Promise.all([
        listOpportunities("active"),
        listStageConfig(),
        listClients("all").catch(() => []),
        listAgents().catch(() => []),
        currentAgentId(),
      ]);
      setOpportunities(opps);
      setStageConfig(cfg);
      setClients(cs);
      setAgents(ags);
      setMyAgentId(agentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las oportunidades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stages = useMemo(() => resolveStages(stageConfig), [stageConfig]);

  const clientName = useCallback(
    (id: string | null) => {
      if (!id) return "Sin cliente";
      const c = clients.find((x) => x.id === id);
      if (!c) return "Cliente";
      return [c.full_name, c.last_name].filter(Boolean).join(" ") || "Cliente";
    },
    [clients],
  );

  const agentName = useCallback(
    (o: Opportunity) => {
      if (!o.assigned_agent_id) return "Sin agente asignado";
      const a = agents.find((x) => x.id === o.assigned_agent_id);
      return a ? agentFullName(a) : "Agente";
    },
    [agents],
  );

  const canEdit = useCallback(
    (o: Opportunity) =>
      canEditOpportunity({
        opportunity: o,
        isAdmin,
        userId: account?.userId ?? null,
        agentId: myAgentId,
      }),
    [isAdmin, account?.userId, myAgentId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (stageFilter !== ALL && o.stage !== stageFilter) return false;
      if (sourceFilter !== ALL && o.lead_source !== sourceFilter) return false;
      if (agentFilter === UNASSIGNED && o.assigned_agent_id) return false;
      if (agentFilter !== ALL && agentFilter !== UNASSIGNED && o.assigned_agent_id !== agentFilter)
        return false;
      if (!q) return true;
      return [o.title, clientName(o.client_id)].some((v) => String(v).toLowerCase().includes(q));
    });
  }, [opportunities, query, stageFilter, agentFilter, sourceFilter, clientName]);

  const totals = useMemo(() => sumByCurrency(filtered), [filtered]);

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-2xl font-semibold sm:text-3xl">
            <Target className="h-5 w-5 shrink-0 text-gold" />
            <span className="truncate">Pipeline comercial</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} oportunidades ·{" "}
            {totals.length === 0
              ? "sin valor estimado"
              : totals.map((t) => formatMoney(t.currency, t.total)).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <OpportunityCreateDialog clients={clients} stages={stages} onCreated={load} />
          <Button

            variant={view === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="mr-2 h-4 w-4" /> Kanban
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
          >
            <List className="mr-2 h-4 w-4" /> Lista
          </Button>
        </div>
      </header>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título o cliente"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las etapas</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.stage} value={s.stage}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Agente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los agentes</SelectItem>
            <SelectItem value={UNASSIGNED}>Sin agente asignado</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {agentFullName(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Origen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los orígenes</SelectItem>
            {LEAD_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando pipeline...
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay oportunidades con los filtros actuales. Las oportunidades se crean desde la ficha
          del cliente o automáticamente al generar una cotización.
        </p>
      ) : view === "kanban" ? (
        <OpportunityKanban
          stages={stages}
          opportunities={filtered}
          clientName={clientName}
          agentName={agentName}
          canEdit={canEdit}
          onChanged={load}
          onEditTracking={setTracking}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Oportunidad</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Agente</th>
                <th className="px-4 py-3">Antigüedad</th>
                <th className="px-4 py-3">Origen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      to="/opportunities/$id"
                      params={{ id: o.id }}
                      className="font-medium hover:underline"
                    >
                      {o.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{clientName(o.client_id)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${stageClasses(o.stage)}`}
                    >
                      {stages.find((s) => s.stage === o.stage)?.label ?? o.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(o.currency, Number(o.estimated_value ?? 0))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{agentName(o)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{daysInStageLabel(o)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sourceLabel(o.lead_source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpportunityTrackingDialog
        opportunity={tracking}
        open={tracking !== null}
        onOpenChange={(v) => !v && setTracking(null)}
        onSaved={load}
      />
    </div>
  );
}
