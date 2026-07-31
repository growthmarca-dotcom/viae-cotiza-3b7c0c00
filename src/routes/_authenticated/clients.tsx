import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, PlusCircle, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientFormDialog } from "@/components/client-form-dialog";
import {
  CLIENT_STATUSES,
  RECORD_STATUSES,
  createClient,
  listClients,
  splitName,
  statusClasses,
  statusLabel,
  type Client,
  type ClientInput,
  type RecordStatus,
} from "@/lib/clients";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
  head: () => ({
    meta: [
      { title: "Clientes — ViaE Sales Hub" },
      { name: "description", content: "Centro de control de clientes y oportunidades comerciales." },
    ],
  }),
});

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setClients(await listClients());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== "all" && c.opportunity_status !== statusFilter) return false;
      if (!q) return true;
      const { firstName, lastName } = splitName(c);
      return [firstName, lastName, c.full_name, c.email, c.phone, c.destination, c.company]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [clients, query, statusFilter]);

  async function handleCreate(input: ClientInput) {
    setSaving(true);
    try {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Sesión no válida.");
      await createClient(input, userData.user.id);
      toast.success("Cliente creado");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-semibold sm:text-4xl">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Centro de control de clientes y oportunidades comerciales.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo cliente
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, apellido, email, WhatsApp o destino"
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Todos los estados</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={recordFilter}
          onChange={(e) => setRecordFilter(e.target.value as RecordStatus | "all")}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="active">Activos</option>
          {RECORD_STATUSES.filter((s) => s.value !== "active").map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}s
            </option>
          ))}
          <option value="all">Todos los registros</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold">
            {clients.length === 0 ? "Aún no hay clientes" : "Sin resultados"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {clients.length === 0
              ? "Se crean automáticamente al generar cotizaciones, o puedes cargarlos manualmente."
              : "Prueba con otro criterio de búsqueda."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="hidden grid-cols-[2fr_1.5fr_1.2fr_1fr] gap-4 border-b border-border px-5 py-3 text-xs uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Cliente</span>
            <span>Contacto</span>
            <span>Ubicación</span>
            <span>Estado</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((c) => {
              const { firstName, lastName } = splitName(c);
              return (
                <li key={c.id}>
                  <Link
                    to="/clients/$id"
                    params={{ id: c.id }}
                    className="grid gap-2 px-5 py-4 transition-colors hover:bg-secondary/40 sm:grid-cols-[2fr_1.5fr_1.2fr_1fr] sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {`${firstName} ${lastName}`.trim() || "Sin nombre"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.company ?? c.destination ?? "—"}
                      </div>
                    </div>
                    <div className="min-w-0 text-sm text-muted-foreground">
                      <div className="truncate">{c.email ?? "—"}</div>
                      <div className="truncate">{c.phone ?? "—"}</div>
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                    </div>
                    <div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(c.opportunity_status)}`}
                      >
                        {statusLabel(c.opportunity_status)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Nuevo cliente"
        submitLabel="Crear cliente"
        submitting={saving}
        onSubmit={handleCreate}
      />
    </div>
  );
}
