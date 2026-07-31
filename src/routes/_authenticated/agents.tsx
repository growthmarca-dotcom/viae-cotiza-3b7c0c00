import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, PlusCircle, Search, UserRound } from "lucide-react";
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
import { AgentFormDialog } from "@/components/agent-form-dialog";
import { useAccount } from "@/hooks/use-account";
import {
  AGENT_STATUSES,
  agentFullName,
  agentStatusClasses,
  agentStatusLabel,
  createAgent,
  listAgents,
  type Agent,
  type AgentInput,
} from "@/lib/agents";

export const Route = createFileRoute("/_authenticated/agents")({
  component: AgentsPage,
  head: () => ({
    meta: [
      { title: "Agentes — ViaE Sales Hub" },
      {
        name: "description",
        content: "Red comercial de agentes: alta, estados, especialidades y asignación de leads.",
      },
      { property: "og:title", content: "Agentes — ViaE Sales Hub" },
      { property: "og:description", content: "Administración de la red comercial de agentes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AgentsPage() {
  const { isAdmin } = useAccount();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setAgents(await listAgents());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los agentes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return [
        a.first_name,
        a.last_name,
        a.email,
        a.whatsapp,
        a.company,
        a.city,
        a.country,
        a.main_zone,
        ...(a.specialties ?? []),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [agents, query, statusFilter]);

  async function handleCreate(input: AgentInput) {
    setSaving(true);
    try {
      await createAgent(input);
      toast.success("Agente creado");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el agente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Agentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Red comercial de ViaE. Los agentes nunca se eliminan: se archivan para conservar el
            historial.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo agente
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, email, WhatsApp, zona o especialidad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {AGENT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando agentes...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <UserRound className="mx-auto mb-3 h-8 w-8 text-gold" />
          No hay agentes que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to="/agents/$id"
              params={{ id: a.id }}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-gold/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{agentFullName(a)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.company || a.email || "Sin datos de contacto"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${agentStatusClasses(a.status)}`}
                >
                  {agentStatusLabel(a.status)}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {[a.city, a.state, a.country].filter(Boolean).join(", ") || "Sin ubicación"}
              </p>
              {(a.specialties ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {a.specialties.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Alta: {new Date(a.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}

      <AgentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Nuevo agente"
        submitLabel="Crear agente"
        submitting={saving}
        onSubmit={handleCreate}
      />
    </div>
  );
}
