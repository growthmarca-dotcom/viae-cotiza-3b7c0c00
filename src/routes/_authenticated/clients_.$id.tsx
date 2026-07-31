import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, History as HistoryIcon, Loader2, Pencil, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientFormDialog } from "@/components/client-form-dialog";
import {
  CLIENT_STATUSES,
  clientToInput,
  deleteClient,
  getClient,
  splitName,
  statusClasses,
  statusLabel,
  updateClient,
  updateClientStatus,
  type Client,
  type ClientInput,
  type ClientStatus,
} from "@/lib/clients";
import { convertTotals, formatMoney } from "@/lib/currency";
import { OpportunityPanel } from "@/components/opportunity-panel";
import { agentFullName, listAssignableAgents } from "@/lib/agents";
import {
  createOpportunity,
  listOpportunitiesByClient,
  type Opportunity,
} from "@/lib/opportunities";

export const Route = createFileRoute("/_authenticated/clients_/$id")({
  component: ClientDetailPage,
  head: () => ({
    meta: [
      { title: "Ficha de cliente — ViaE Sales Hub" },
      { name: "description", content: "Historial comercial y cotizaciones del cliente." },
    ],
  }),
});

type QuotationRow = {
  id: string;
  title: string;
  status: string;
  total_amount: number | null;
  currency: string;
  exchange_rate: number | null;
  created_at: string;
  destination: string | null;
};

type HistoryEntry = {
  id: string;
  action: string;
  created_at: string;
  quotation_id: string;
};

function describeHistory(action: string) {
  if (action === "created") return "Cotización creada";
  if (action === "updated") return "Cotización actualizada";
  if (action === "archived") return "Cotización archivada";
  if (action === "unarchived") return "Cotización desarchivada";
  return action;
}

function ClientDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [responsables, setResponsables] = useState<{ id: string; label: string }[]>([]);
  const [agentOptions, setAgentOptions] = useState<{ id: string; label: string }[]>([]);
  const [creatingOpp, setCreatingOpp] = useState(false);

  async function loadOpportunities() {
    try {
      setOpportunities(await listOpportunitiesByClient(id));
    } catch {
      setOpportunities([]);
    }
  }

  useEffect(() => {
    listAssignableAgents()
      .then((rows) => setAgentOptions(rows.map((a) => ({ id: a.id, label: agentFullName(a) }))))
      .catch(() => setAgentOptions([]));
  }, []);


  async function load() {
    setLoading(true);
    try {
      const c = await getClient(id);
      if (!c) {
        toast.error("Cliente no encontrado");
        setLoading(false);
        return;
      }
      setClient(c);

      const { data: qs } = await supabase
        .from("quotations")
        .select("id, title, status, total_amount, currency, exchange_rate, created_at, destination")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      const rows = (qs ?? []) as QuotationRow[];
      setQuotations(rows);

      if (rows.length > 0) {
        const { data: h } = await supabase
          .from("quotation_history")
          .select("id, action, created_at, quotation_id")
          .in(
            "quotation_id",
            rows.map((r) => r.id),
          )
          .order("created_at", { ascending: false })
          .limit(30);
        setHistory((h ?? []) as HistoryEntry[]);
      } else {
        setHistory([]);
      }

      await loadOpportunities();

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", userData.user.id)
          .maybeSingle();
        setResponsables([
          {
            id: userData.user.id,
            label: profile?.full_name || userData.user.email || "Yo",
          },
        ]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el cliente");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOpportunity() {
    setCreatingOpp(true);
    try {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Sesión no válida.");
      await createOpportunity({
        userId: userData.user.id,
        clientId: id,
        title: `Oportunidad ${new Date().toLocaleDateString()}`,
      });
      toast.success("Oportunidad creada");
      await loadOpportunities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la oportunidad");
    } finally {
      setCreatingOpp(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStatus(value: string) {
    if (!client) return;
    const prev = client.opportunity_status;
    setClient({ ...client, opportunity_status: value as ClientStatus });
    try {
      await updateClientStatus(id, value as ClientStatus);
      toast.success(`Estado actualizado: ${statusLabel(value)}`);
    } catch (err) {
      setClient({ ...client, opportunity_status: prev });
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado");
    }
  }

  async function handleUpdate(input: ClientInput) {
    setSaving(true);
    try {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Sesión no válida.");
      await updateClient(id, input, userData.user.id);
      toast.success("Cliente actualizado");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el cliente");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteClient(id);
      toast.success("Cliente eliminado");
      navigate({ to: "/clients" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el cliente");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando...
      </div>
    );
  }
  if (!client) return null;

  const { firstName, lastName } = splitName(client);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a clientes
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">
            {`${firstName} ${lastName}`.trim() || "Sin nombre"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {client.company ? `${client.company} · ` : ""}Cliente desde{" "}
            {new Date(client.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Estado comercial</h2>
            <p className="text-sm text-muted-foreground">
              Actual:{" "}
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses(client.opportunity_status)}`}
              >
                {statusLabel(client.opportunity_status)}
              </span>
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Select value={client.opportunity_status} onValueChange={handleStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-display text-xl font-semibold">Datos del cliente</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row label="Nombre" value={firstName} />
          <Row label="Apellido" value={lastName} />
          <Row label="Empresa" value={client.company} />
          <Row label="WhatsApp" value={client.phone} />
          <Row label="Email" value={client.email} />
          <Row label="Ciudad" value={client.city} />
          <Row label="País" value={client.country} />
          <Row label="Fecha de creación" value={new Date(client.created_at).toLocaleDateString()} />
          <Row label="Observaciones" value={client.notes} multiline />
        </dl>
      </div>

      <OpportunityPanel
        opportunities={opportunities}
        responsables={responsables}
        agents={agentOptions}
        creating={creatingOpp}
        onCreate={handleCreateOpportunity}
        onChanged={loadOpportunities}
      />



      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-display text-xl font-semibold">Cotizaciones</h2>
        {quotations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este cliente todavía no tiene cotizaciones.</p>
        ) : (
          <ul className="divide-y divide-border">
            {quotations.map((q) => {
              const totals = convertTotals(q.total_amount, q.currency, q.exchange_rate);
              return (
                <li key={q.id} className="py-3">
                  <Link
                    to="/quotations/$id"
                    params={{ id: q.id }}
                    className="flex flex-col gap-1 hover:text-primary sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{q.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString()}
                        {q.destination ? ` · ${q.destination}` : ""} · {q.status}
                      </div>
                    </div>
                    <div className="text-sm sm:text-right">
                      <div className="font-medium">{formatMoney(q.currency, q.total_amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {totals.totalUsd != null ? formatMoney("USD", totals.totalUsd) : "—"} ·{" "}
                        {totals.totalArs != null ? formatMoney("ARS", totals.totalArs) : "—"}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <HistoryIcon className="h-4 w-4 text-gold" /> Historial de modificaciones
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          {history.length === 0 && (
            <li className="text-muted-foreground">Sin modificaciones registradas todavía.</li>
          )}
          {history.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2"
            >
              <span>{describeHistory(h.action)}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(h.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ClientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={clientToInput(client)}
        title="Editar cliente"
        submitLabel="Guardar cambios"
        submitting={saving}
        onSubmit={handleUpdate}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Las cotizaciones asociadas se mantienen, pero perderán el vínculo con esta ficha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: unknown; multiline?: boolean }) {
  const v = value == null || value === "" ? "—" : String(value);
  return (
    <div className={multiline ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm ${multiline ? "whitespace-pre-wrap" : ""}`}>{v}</dd>
    </div>
  );
}
