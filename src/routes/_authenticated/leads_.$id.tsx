import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Archive, Loader2, MessageSquarePlus, Pencil, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { sourceLabel } from "@/lib/opportunities";
import { formatMoney } from "@/lib/currency";
import {
  addLeadComment,
  assignLead,
  convertLeadToClient,
  getLead,
  historyActionLabel,
  LEAD_STATUSES,
  leadFullName,
  leadStatusClasses,
  leadStatusLabel,
  leadToInput,
  leadDurationLabel,
  leadPaxLabel,
  listLeadHistory,
  serviceLabels,
  setLeadRecordStatus,
  setLeadStatus,
  tripTypeLabel,
  updateLead,
  type Lead,
  type LeadHistory,
  type LeadInput,
  type LeadStatus,
} from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/leads_/$id")({
  component: LeadDetailPage,
  head: () => ({
    meta: [
      { title: "Ficha del lead — ViaE Sales Hub" },
      {
        name: "description",
        content: "Detalle del lead: datos del viaje, agente asignado, historial y conversión.",
      },
      { property: "og:title", content: "Ficha del lead — ViaE Sales Hub" },
      { property: "og:description", content: "Seguimiento comercial de la consulta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const UNASSIGNED = "__none__";

function LeadDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAccount();
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, h, a] = await Promise.all([getLead(id), listLeadHistory(id), listAgents()]);
      setLead(l);
      setHistory(h);
      setAgents(a);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el lead");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdate(input: LeadInput) {
    setSaving(true);
    try {
      await updateLead(id, input);
      toast.success("Lead actualizado");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el lead");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(status: LeadStatus) {
    try {
      await setLeadStatus(id, status);
      toast.success(`Estado: ${leadStatusLabel(status)}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  }

  async function handleAssign(agentId: string) {
    try {
      await assignLead(id, agentId === UNASSIGNED ? null : agentId);
      toast.success("Asignación actualizada");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo asignar el lead");
    }
  }

  async function handleComment() {
    if (!lead || !comment.trim()) return;
    try {
      await addLeadComment(lead, comment);
      setComment("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el comentario");
    }
  }

  async function handleConvert() {
    if (!lead) return;
    try {
      const clientId = await convertLeadToClient(lead);
      toast.success("Lead convertido en cliente");
      navigate({ to: "/clients/$id", params: { id: clientId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo convertir el lead");
    }
  }

  async function handleArchive() {
    try {
      await setLeadRecordStatus(id, "archived");
      toast.success("Lead archivado");
      navigate({ to: "/leads" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo archivar el lead");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha del lead...
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="mx-auto w-full max-w-3xl py-16 text-center">
        <p className="text-muted-foreground">No se encontró el lead solicitado.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/leads">Volver a la bandeja</Link>
        </Button>
      </div>
    );
  }

  const assignedAgent = agents.find((a) => a.id === lead.assigned_agent_id);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/leads">
          <ArrowLeft className="mr-2 h-4 w-4" /> Bandeja de consultas
        </Link>
      </Button>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold">{leadFullName(lead)}</h1>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${leadStatusClasses(lead.status)}`}
              >
                {leadStatusLabel(lead.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[lead.whatsapp, lead.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
            </p>
            <p className="text-xs text-muted-foreground">
              {[lead.city, lead.country].filter(Boolean).join(", ") || "Sin ubicación"} · Origen:{" "}
              {sourceLabel(lead.source)} · Alta: {new Date(lead.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={lead.status} onValueChange={(v) => handleStatus(v as LeadStatus)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" onClick={handlePipeline}>
              <Target className="mr-2 h-4 w-4" /> Ver en Pipeline
            </Button>

            {isAdmin && (
              <Button variant="ghost" onClick={handleArchive}>
                <Archive className="mr-2 h-4 w-4" /> Archivar
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Info label="Tipo de viaje" value={tripTypeLabel(lead.trip_type)} />
          <Info label="Destino de interés" value={lead.destination || "—"} />
          <Info
            label="Fecha estimada"
            value={lead.travel_date ? new Date(lead.travel_date).toLocaleDateString() : "—"}
          />
          <Info label="Duración estimada" value={leadDurationLabel(lead) || "—"} />
          <Info label="Pasajeros" value={leadPaxLabel(lead) || "—"} />
          <Info
            label="Presupuesto estimado"
            value={
              lead.budget_amount != null
                ? formatMoney(lead.budget_currency, Number(lead.budget_amount))
                : "—"
            }
          />
          <Info label="Idioma" value={lead.language || "—"} />
          <Info
            label="Cliente vinculado"
            value={lead.client_id ? "Convertido" : "Todavía no convertido"}
          />
        </div>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Servicios de interés
          </p>
          {serviceLabels(lead.services_interest).length === 0 ? (
            <p className="text-sm">—</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {serviceLabels(lead.services_interest).map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {lead.commercial_notes && (
          <div className="mt-4 rounded-xl border border-border bg-background p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Observaciones comerciales
            </p>
            <p className="whitespace-pre-line text-sm">{lead.commercial_notes}</p>
          </div>
        )}

        {lead.notes && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Comentarios</p>
            <p className="whitespace-pre-line text-sm">{lead.notes}</p>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-xl font-semibold">Asignación comercial</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            El agente asignado recibe una notificación interna y ve el lead en su panel.
          </p>
          <div className="mt-4">
            <Select
              value={lead.assigned_agent_id ?? UNASSIGNED}
              onValueChange={handleAssign}
            >
              <SelectTrigger>
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
          </div>
          {assignedAgent && (
            <p className="mt-3 text-xs text-muted-foreground">
              <Link
                to="/agents/$id"
                params={{ id: assignedAgent.id }}
                className="text-primary hover:underline"
              >
                Ver ficha de {agentFullName(assignedAgent)}
              </Link>
              {lead.assigned_at
                ? ` · Asignado el ${new Date(lead.assigned_at).toLocaleDateString()}`
                : ""}
            </p>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="font-display text-lg font-semibold">Conversión</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Al convertir, el lead se transforma en cliente del CRM (sin duplicar registros
              existentes) y queda listo para cotizar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handleConvert} disabled={Boolean(lead.client_id)}>
                <UserCheck className="mr-2 h-4 w-4" />
                {lead.client_id ? "Ya convertido" : "Convertir en cliente"}
              </Button>
              {lead.client_id && (
                <Button asChild variant="outline">
                  <Link to="/clients/$id" params={{ id: lead.client_id }}>
                    Ver cliente
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-xl font-semibold">Historial de actividad</h2>
          <div className="mt-4 space-y-2">
            <Textarea
              rows={2}
              placeholder="Agregar un comentario al historial..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleComment} disabled={!comment.trim()}>
                <MessageSquarePlus className="mr-2 h-4 w-4" /> Agregar
              </Button>
            </div>
          </div>

          {history.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Todavía no hay actividad registrada.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {history.map((h) => (
                <li key={h.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{historyActionLabel(h.action)}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  {(h.from_status || h.to_status) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {h.from_status ? `${leadStatusLabel(h.from_status)} → ` : ""}
                      {h.to_status ? leadStatusLabel(h.to_status) : ""}
                    </p>
                  )}
                  {h.comment && <p className="mt-1 whitespace-pre-line text-sm">{h.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <LeadFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar lead"
        submitLabel="Guardar cambios"
        submitting={saving}
        initial={leadToInput(lead)}
        agents={agents}
        onSubmit={handleUpdate}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
