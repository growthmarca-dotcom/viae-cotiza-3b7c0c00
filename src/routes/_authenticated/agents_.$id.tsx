import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Link as LinkIcon,
  Loader2,
  Mail,
  Pencil,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentFormDialog } from "@/components/agent-form-dialog";
import { BeneficiaryAuthorizationPanel } from "@/components/beneficiary-authorization-panel";
import { PersonLinkCard } from "@/components/person-link-card";
import { linkAgentToPerson } from "@/lib/persons";
import { useAccount } from "@/hooks/use-account";
import { formatMoney, toAnalysisCurrency } from "@/lib/currency";
import { useAnalysisCurrency } from "@/hooks/use-analysis-currency";
import { stageClasses, stageLabel, type Opportunity } from "@/lib/opportunities";
import {
  computeLeadStats,
  leadFullName,
  leadNeedSummary,
  leadStatusClasses,
  leadStatusLabel,
  listLeadsByAgent,
  type Lead,
} from "@/lib/leads";
import {
  AGENT_STATUSES,
  agentFullName,
  agentStatusClasses,
  agentStatusLabel,
  agentToInput,
  computeAgentStats,
  getAgent,
  inviteAgentUser,
  invitationStatusClasses,
  invitationStatusLabel,
  isInvitationExpired,
  linkAgentUser,
  listLinkableProfiles,
  listOpportunitiesByAgent,
  setAgentStatus,
  setInvitationStatus,
  unlinkAgentUser,
  updateAgent,
  type Agent,
  type AgentInput,
  type AgentStatus,
  type LinkableProfile,
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

/** Actividad comercial del agente sobre los leads asignados (v1.7). */
function AgentLeadsSection({ agentId }: { agentId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    listLeadsByAgent(agentId)
      .then(setLeads)
      .catch(() => setLeads([]));
  }, [agentId]);

  const stats = computeLeadStats(leads);

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-xl font-semibold">Actividad comercial (consultas)</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Leads asignados" value={stats.total} />
        <Stat label="Contactados" value={stats.contacted} />
        <Stat label="Cotizados" value={stats.quoted} />
        <Stat label="Ganados" value={stats.won} />
        <Stat label="Perdidos" value={stats.lost} />
        <Stat label="Conversión de leads" value={`${stats.conversion}%`} />
      </div>
      {leads.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-3 font-display text-lg font-semibold">Últimas consultas</h3>
          <ul className="space-y-2">
            {leads.slice(0, 6).map((l) => (
              <li key={l.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to="/leads/$id"
                    params={{ id: l.id }}
                    className="font-medium hover:text-primary"
                  >
                    {leadFullName(l)}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {l.destination || "Sin destino"} ·{" "}
                    <span
                      className={`rounded-full border px-2 py-0.5 ${leadStatusClasses(l.status)}`}
                    >
                      {leadStatusLabel(l.status)}
                    </span>
                  </span>
                </div>
                {leadNeedSummary(l) && (
                  <p className="mt-1 text-xs text-muted-foreground">{leadNeedSummary(l)}</p>
                )}
                {l.commercial_notes && (
                  <p className="mt-1 whitespace-pre-line text-xs text-foreground/80">
                    {l.commercial_notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}


function AgentDetailPage() {
  const { id } = Route.useParams();
  const { isAdmin } = useAccount();
  const analysisCurrency = useAnalysisCurrency();
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
              Configuración de comisión
            </p>
            <p className="text-sm">
              Definida por acuerdos comerciales
              <span className="block text-xs text-muted-foreground">
                Fuente única: Acuerdos comerciales → Reglas
              </span>
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

      <div className="mt-6 space-y-6">
        <PersonLinkCard
          personId={agent.person_id}
          suggestion={{
            first_name: agent.first_name ?? "",
            last_name: agent.last_name ?? "",
            email: agent.email ?? "",
            phone: agent.whatsapp ?? "",
          }}
          description="Vincula al agente con su identidad maestra en Personas. Los datos históricos del agente no se modifican."
          onLink={async (personId) => {
            await linkAgentToPerson(agent.id, personId);
            await load();
          }}
        />
        <BeneficiaryAuthorizationPanel beneficiaryType="agent" beneficiaryId={agent.id} />
      </div>

      {isAdmin && <AccessSection agent={agent} onChanged={load} />}


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

      <AgentLeadsSection agentId={id} />



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

/** Gestión del acceso al sistema: invitación y vinculación de usuario. */
function AccessSection({ agent, onChanged }: { agent: Agent; onChanged: () => void }) {
  const [email, setEmail] = useState(agent.invited_email ?? "");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<LinkableProfile[]>([]);

  useEffect(() => {
    listLinkableProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, [agent.id, agent.user_id]);

  const expired = isInvitationExpired(agent);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  }

  const linkedProfile = profiles.find((p) => p.id === agent.user_id);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <ShieldCheck className="h-4 w-4 text-gold" /> Acceso al sistema
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Vincula este agente con un usuario para que pueda iniciar sesión y ver únicamente su
        cartera. El agente puede existir sin acceso.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Estado:</span>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${invitationStatusClasses(
            expired ? "expired" : agent.invitation_status,
          )}`}
        >
          {agent.access_status === "linked"
            ? "Usuario vinculado"
            : `Invitación: ${invitationStatusLabel(expired ? "expired" : agent.invitation_status)}`}
        </span>
        {agent.user_id && (
          <span className="text-muted-foreground">
            {linkedProfile?.full_name ?? agent.invited_email ?? agent.user_id.slice(0, 8)}
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Invitar por email</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agente@empresa.com"
            />
            <Button
              variant="outline"
              disabled={busy || !email.trim()}
              onClick={() => run(() => inviteAgentUser(agent.id, email), "Invitación registrada")}
            >
              <Mail className="mr-2 h-4 w-4" /> Invitar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            La invitación queda registrada y vence a los 7 días. El envío automático del email se
            habilitará más adelante.
          </p>
          {agent.invitation_status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(() => setInvitationStatus(agent.id, "rejected"), "Invitación rechazada")
                }
              >
                Marcar rechazada
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(() => setInvitationStatus(agent.id, "expired"), "Invitación expirada")
                }
              >
                Marcar expirada
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Vincular usuario existente</Label>
          <div className="flex gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Seleccionar usuario...</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.id.slice(0, 8)}
                  {p.agency_name ? ` · ${p.agency_name}` : ""}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={busy || !selected}
              onClick={() =>
                run(
                  () => linkAgentUser(agent.id, selected),
                  agent.user_id ? "Usuario reemplazado" : "Usuario vinculado",
                )
              }
            >
              <LinkIcon className="mr-2 h-4 w-4" /> {agent.user_id ? "Reemplazar" : "Vincular"}
            </Button>
          </div>
          {agent.user_id && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => run(() => unlinkAgentUser(agent.id), "Usuario desvinculado")}
            >
              <Unlink className="mr-2 h-4 w-4" /> Desvincular usuario
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
