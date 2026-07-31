import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-account";
import { agentFullName, listAgents, type Agent } from "@/lib/agents";
import { listBookings, bookingStatusLabel, type Booking } from "@/lib/bookings";
import {
  computeOperationsStats,
  listAllBookingServices,
  listInternalUsers,
  OPERATION_STATUSES,
  operationStatusClasses,
  operationStatusLabel,
  SERVICE_KINDS,
  serviceKindLabel,
  setOperationsOwner,
  setOperationStatus,
  type BookingService,
  type InternalUser,
  type OperationStatus,
} from "@/lib/operations";
import {
  computeChecklistIncidentStats,
  computeChecklistProgress,
  listAllIncidents,
  listChecklistByBooking,
  type ChecklistItem,
  type Incident,
} from "@/lib/checklist";
import { ChecklistProgressBar } from "@/components/booking-checklist-panel";

export const Route = createFileRoute("/_authenticated/operations")({
  component: OperationsPage,
  head: () => ({
    meta: [
      { title: "Central operativa — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Bandeja operativa de reservas: estado de operación, responsable interno, servicios incluidos y coordinación de proveedores.",
      },
      { property: "og:title", content: "Central operativa — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "El agente vende, la central opera: coordinación de servicios y recursos por reserva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL = "all";
const NONE = "__none__";

type ClientRow = { id: string; full_name: string; last_name: string | null };

function OperationsPage() {
  const { isOperations, isLoading } = useAccount();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [checklistByBooking, setChecklistByBooking] = useState<Map<string, ChecklistItem[]>>(
    new Map(),
  );
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [agentFilter, setAgentFilter] = useState(ALL);
  const [serviceFilter, setServiceFilter] = useState(ALL);
  const [destinationFilter, setDestinationFilter] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s, a, u, cl, inc] = await Promise.all([
        listBookings(),
        listAllBookingServices(),
        listAgents().catch(() => [] as Agent[]),
        listInternalUsers().catch(() => [] as InternalUser[]),
        listChecklistByBooking().catch(() => new Map<string, ChecklistItem[]>()),
        listAllIncidents().catch(() => [] as Incident[]),
      ]);
      setBookings(b);
      setServices(s);
      setAgents(a);
      setUsers(u);
      setChecklistByBooking(cl);
      setIncidents(inc);

      const ids = Array.from(new Set(b.map((x) => x.client_id).filter(Boolean)));
      if (ids.length) {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("clients")
          .select("id, full_name, last_name")
          .in("id", ids);
        setClients((data as ClientRow[]) ?? []);
      } else setClients([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la bandeja operativa");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOperations) load();
    else setLoading(false);
  }, [isOperations, load]);

  const servicesByBooking = useMemo(() => {
    const map = new Map<string, BookingService[]>();
    for (const s of services) {
      const list = map.get(s.booking_id) ?? [];
      list.push(s);
      map.set(s.booking_id, list);
    }
    return map;
  }, [services]);

  const destinations = useMemo(
    () => Array.from(new Set(bookings.map((b) => b.destination).filter(Boolean))) as string[],
    [bookings],
  );

  const clientName = useCallback(
    (id: string) => {
      const c = clients.find((x) => x.id === id);
      return c ? [c.full_name, c.last_name].filter(Boolean).join(" ") : "Cliente";
    },
    [clients],
  );

  const agentName = useCallback(
    (id: string | null) => {
      if (!id) return "Sin agente";
      const a = agents.find((x) => x.id === id);
      return a ? agentFullName(a) : "Agente";
    },
    [agents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== ALL && b.operation_status !== statusFilter) return false;
      if (agentFilter !== ALL && b.assigned_agent_id !== agentFilter) return false;
      if (destinationFilter !== ALL && b.destination !== destinationFilter) return false;
      if (dateFrom && (!b.travel_start || b.travel_start < dateFrom)) return false;
      if (dateTo && (!b.travel_start || b.travel_start > dateTo)) return false;
      if (serviceFilter !== ALL) {
        const list = servicesByBooking.get(b.id) ?? [];
        if (!list.some((s) => s.kind === serviceFilter)) return false;
      }
      if (!q) return true;
      return [b.booking_number, b.destination, clientName(b.client_id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [
    bookings,
    statusFilter,
    agentFilter,
    destinationFilter,
    dateFrom,
    dateTo,
    serviceFilter,
    servicesByBooking,
    query,
    clientName,
  ]);

  const stats = useMemo(() => computeOperationsStats(bookings, services), [bookings, services]);
  const opsStats = useMemo(
    () => computeChecklistIncidentStats(checklistByBooking, incidents),
    [checklistByBooking, incidents],
  );

  async function changeStatus(b: Booking, status: OperationStatus) {
    try {
      await setOperationStatus(b.id, status);
      toast.success(`Estado operativo: ${operationStatusLabel(status)}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado");
    }
  }

  async function changeOwner(b: Booking, userId: string) {
    try {
      await setOperationsOwner(b.id, userId === NONE ? null : userId);
      toast.success("Responsable operativo actualizado");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo asignar el responsable");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
      </div>
    );
  }

  if (!isOperations) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-gold" />
        <h1 className="font-display text-2xl font-semibold">Área operativa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta sección es exclusiva de la central: administración y usuarios con rol Operaciones.
          Si vendés, seguí tus reservas desde el módulo Reservas.
        </p>
      </div>
    );
  }

  const cards = [
    { label: "Reservas pendientes", value: stats.pending },
    { label: "Viajes próximos (7 días)", value: stats.upcoming },
    { label: "Servicios sin asignar", value: stats.unassignedServices },
    { label: "Reservas con incidencias", value: opsStats.bookingsWithIncidents },
    { label: "Incidencias abiertas", value: opsStats.openIncidents },
    { label: "Incidencias urgentes", value: opsStats.urgentIncidents },
    { label: "Listas para viajar", value: opsStats.readyToTravel },
    { label: "Avance operativo promedio", value: `${opsStats.averageProgress} %` },
    { label: "Servicios finalizados", value: stats.finishedServices },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Central operativa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El agente vende, la central opera. Acá se coordina la ejecución del servicio: responsable
          interno, estado operativo, servicios incluidos y proveedores.
        </p>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </section>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por reserva, cliente o destino"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {OPERATION_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={destinationFilter} onValueChange={setDestinationFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los destinos</SelectItem>
            {destinations.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los servicios</SelectItem>
            {SERVICE_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los agentes</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {agentFullName(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-[150px]"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          className="w-[150px]"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando reservas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-3 h-8 w-8 text-gold" />
          No hay reservas que coincidan con los filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const list = servicesByBooking.get(b.id) ?? [];
            const progress = computeChecklistProgress(checklistByBooking.get(b.id) ?? []);
            const openIncidents = incidents.filter(
              (i) => i.booking_id === b.id && (i.status === "open" || i.status === "in_review"),
            );
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-gold/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/bookings/$id"
                      params={{ id: b.id }}
                      className="font-medium hover:text-primary"
                    >
                      {b.booking_number ?? "Reserva"} · {clientName(b.client_id)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {b.destination ?? "Sin destino"} · Viaje: {b.travel_start ?? "sin fecha"}
                      {b.travel_end ? ` → ${b.travel_end}` : ""} · Vendedor:{" "}
                      {agentName(b.assigned_agent_id)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Comercial: {bookingStatusLabel(b.status)} ·{" "}
                      {list.length === 0
                        ? "Sin servicios cargados"
                        : list.map((s) => serviceKindLabel(s.kind)).join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${operationStatusClasses(b.operation_status)}`}
                    >
                      {operationStatusLabel(b.operation_status)}
                    </span>
                    <Select
                      value={b.operation_status}
                      onValueChange={(v) => changeStatus(b, v as OperationStatus)}
                    >
                      <SelectTrigger className="h-8 w-[190px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATION_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={b.operations_owner_id ?? NONE}
                      onValueChange={(v) => changeOwner(b, v)}
                    >
                      <SelectTrigger className="h-8 w-[190px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin responsable operativo</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Tomada:{" "}
                  {b.operations_taken_at
                    ? new Date(b.operations_taken_at).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}{" "}
                  · Última actualización operativa:{" "}
                  {b.operations_updated_at
                    ? new Date(b.operations_updated_at).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
