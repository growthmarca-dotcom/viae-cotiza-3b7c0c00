import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Loader2, PlusCircle, Search, Sparkles } from "lucide-react";
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
import { LeadFormDialog } from "@/components/lead-form-dialog";
import { useAccount } from "@/hooks/use-account";
import { agentFullName, listAgents, type Agent } from "@/lib/agents";
import { fetchCompany } from "@/lib/company";
import { LEAD_SOURCES, sourceLabel } from "@/lib/opportunities";
import { formatMoney } from "@/lib/currency";
import {
  assignLead,
  computeLeadStats,
  countActiveLeadsByAgent,
  createLead,
  LEAD_STATUSES,
  leadFullName,
  leadStatusClasses,
  leadStatusLabel,
  listLeads,
  parseAssignmentRules,
  suggestAgentForLead,
  type Lead,
  type LeadInput,
} from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
  head: () => ({
    meta: [
      { title: "Bandeja de consultas — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Bandeja comercial de leads: consultas entrantes, asignación de agentes y seguimiento del ciclo de vida.",
      },
      { property: "og:title", content: "Bandeja de consultas — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Distribución de leads y seguimiento comercial de la red de agentes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL = "all";
const UNASSIGNED = "__none__";

function LeadsPage() {
  const { isAdmin } = useAccount();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [agentFilter, setAgentFilter] = useState(ALL);
  const [sourceFilter, setSourceFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<"manual" | "automatic">("manual");
  const [rules, setRules] = useState(parseAssignmentRules(null));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, a, company] = await Promise.all([listLeads("active"), listAgents(), fetchCompany()]);
      setLeads(l);
      setAgents(a);
      setAssignmentMode(
        (company.row?.lead_assignment_mode as "manual" | "automatic" | undefined) ?? "manual",
      );
      setRules(parseAssignmentRules(company.row?.lead_assignment_rules));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agentName = useCallback(
    (id: string | null) => {
      if (!id) return "Sin asignar";
      const a = agents.find((x) => x.id === id);
      return a ? agentFullName(a) : "Agente";
    },
    [agents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== ALL && l.status !== statusFilter) return false;
      if (sourceFilter !== ALL && l.source !== sourceFilter) return false;
      if (agentFilter === UNASSIGNED && l.assigned_agent_id) return false;
      if (agentFilter !== ALL && agentFilter !== UNASSIGNED && l.assigned_agent_id !== agentFilter)
        return false;
      if (!q) return true;
      return [l.first_name, l.last_name, l.email, l.whatsapp, l.destination, l.city, l.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, query, statusFilter, agentFilter, sourceFilter]);

  const stats = useMemo(() => computeLeadStats(leads), [leads]);
  const activeByAgent = useMemo(() => countActiveLeadsByAgent(leads), [leads]);

  async function handleCreate(input: LeadInput) {
    setSaving(true);
    try {
      await createLead(input);
      toast.success("Lead registrado");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el lead");
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoAssign(lead: Lead) {
    const suggestion = suggestAgentForLead(lead, agents, rules, activeByAgent);
    if (!suggestion) {
      toast.error("Ningún agente cumple las reglas de asignación configuradas.");
      return;
    }
    try {
      await assignLead(lead.id, suggestion.agent.id);
      toast.success(
        `Asignado a ${agentFullName(suggestion.agent)}${
          suggestion.reasons.length ? ` · ${suggestion.reasons[0]}` : ""
        }`,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo asignar el lead");
    }
  }

  async function handleManualAssign(lead: Lead, agentId: string) {
    try {
      await assignLead(lead.id, agentId === UNASSIGNED ? null : agentId);
      toast.success("Asignación actualizada");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo asignar el lead");
    }
  }

  const cards = [
    { label: "Leads activos", value: stats.total },
    { label: "Sin asignar", value: stats.unassigned },
    { label: "Contactados", value: stats.contacted },
    { label: "Cotizados", value: stats.quoted },
    { label: "Ganados", value: stats.won },
    { label: "Conversión", value: `${stats.conversion}%` },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Bandeja de consultas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada consulta entrante se registra como lead y avanza por el ciclo comercial:
            consulta → agente → cotización → venta.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nuevo lead
        </Button>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </section>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, contacto o destino"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los agentes</SelectItem>
            <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {agentFullName(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
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
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando consultas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-gold" />
          No hay consultas que coincidan con los filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <div
              key={l.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-gold/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/leads/$id"
                    params={{ id: l.id }}
                    className="font-medium hover:text-primary"
                  >
                    {leadFullName(l)}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {[l.whatsapp, l.email].filter(Boolean).join(" · ") || "Sin contacto"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {l.destination || "Sin destino"}
                    {l.travel_date ? ` · ${new Date(l.travel_date).toLocaleDateString()}` : ""}
                    {l.pax_count ? ` · ${l.pax_count} pax` : ""}
                    {l.budget_amount != null
                      ? ` · ${formatMoney(l.budget_currency, Number(l.budget_amount))}`
                      : ""}
                    {` · ${sourceLabel(l.source)}`}
                  </p>
                  {leadNeedSummary(l) && (
                    <p className="mt-1 text-xs text-foreground/80">{leadNeedSummary(l)}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${leadStatusClasses(l.status)}`}
                  >
                    {leadStatusLabel(l.status)}
                  </span>
                  <Select
                    value={l.assigned_agent_id ?? UNASSIGNED}
                    onValueChange={(v) => handleManualAssign(l, v)}
                  >
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {agentFullName(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignmentMode === "automatic" && isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => handleAutoAssign(l)}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Sugerir
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/leads/$id" params={{ id: l.id }}>
                      Ver ficha
                    </Link>
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Responsable: {agentName(l.assigned_agent_id)} · Última actividad:{" "}
                {new Date(l.last_activity_at).toLocaleString("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      <LeadFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Nuevo lead"
        submitLabel="Registrar lead"
        submitting={saving}
        agents={agents}
        onSubmit={handleCreate}
      />
    </div>
  );
}
