import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Bell,
  CarFront,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  MapPin,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  availabilityClasses,
  availabilityLabel,
  RESOURCE_AVAILABILITIES,
  type Resource,
  type ResourceAvailability,
} from "@/lib/resources";
import {
  collectionStatusClasses,
  collectionStatusLabel,
  driverFullName,
  paymentModeLabel,
  serviceStatusClasses,
  serviceStatusLabel,
  serviceTypeLabel,
  vehicleDescription,
  type TransportService,
  type TransportServiceEvent,
} from "@/lib/transport";
import {
  acceptService,
  arriveAtOrigin,
  completeService,
  confirmCollection,
  lastUpdateOf,
  listMyDriverResources,
  listMyDriverServices,
  listMyServiceContext,
  listServiceHistory,
  nextDriverActions,
  passengerOnboard,
  rejectService,
  REJECTION_REASONS,
  setMyAvailability,
  startService,
  type DriverServiceContext,
} from "@/lib/driver";
import {
  driverDaySummary,
  filterDriverServices,
  timeLabel,
  todayISO,
  type DriverFilter,
} from "@/lib/transport-ops";
import {
  assignmentPayload,
  listMyNotifications,
  markAllNotificationsRead,
  unreadCount,
  type Notification,
} from "@/lib/notifications";


export const Route = createFileRoute("/_authenticated/driver")({
  component: DriverPage,
  head: () => ({
    meta: [
      { title: "Panel del conductor — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Panel operativo del conductor: servicios asignados, flujo del viaje, disponibilidad y cobro al pasajero.",
      },
      { property: "og:title", content: "Panel del conductor — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Gestioná tus traslados asignados, tu disponibilidad y el cobro al pasajero.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function fmt(dt: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function DriverPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [services, setServices] = useState<TransportService[]>([]);
  const [context, setContext] = useState<Map<string, DriverServiceContext>>(new Map());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<DriverFilter>("today");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mine = await listMyDriverResources();
      setResources(mine);
      const [svcs, ctx, notis] = await Promise.all([
        listMyDriverServices(mine.map((r) => r.id)),
        listMyServiceContext(),
        listMyNotifications(),
      ]);
      setServices(svcs);
      setContext(ctx);
      setNotifications(notis);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar tu panel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const driver = resources.find((r) => r.category === "driver") ?? resources[0] ?? null;
  const vehicleById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const summary = useMemo(() => driverDaySummary(services), [services]);
  const visible = useMemo(() => filterDriverServices(services, filter), [services, filter]);
  const counts = useMemo(
    () => ({
      today: filterDriverServices(services, "today").length,
      upcoming: filterDriverServices(services, "upcoming").length,
      history: filterDriverServices(services, "history").length,
    }),
    [services],
  );
  const unread = useMemo(() => notifications.filter((n) => n.read_at == null), [notifications]);

  

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando tu panel...
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <UserRound className="mx-auto h-8 w-8 text-gold" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Panel del conductor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu usuario todavía no está vinculado a una ficha de conductor de la red. Pedile a un
          administrador que vincule tu usuario desde Recursos → ficha del conductor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Panel del conductor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {driverFullName(driver)}
            {driver.base_city ? ` · ${driver.base_city}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${availabilityClasses(driver.availability)}`}
          >
            {availabilityLabel(driver.availability)}
          </span>
          <Select
            value={driver.availability}
            onValueChange={(v) =>
              run(
                () => setMyAvailability(driver.id, v as ResourceAvailability),
                "Disponibilidad actualizada",
              )
            }
          >
            <SelectTrigger className="w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_AVAILABILITIES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={busy || driver.availability === "available"}
            onClick={() => run(() => setMyAvailability(driver.id, "available"), "Estás disponible")}
          >
            ESTOY DISPONIBLE
          </Button>
        </div>
      </header>

      <p className="rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs text-muted-foreground">
        Tu disponibilidad se actualiza sola: pasás a <strong>En viaje / ocupado</strong> cuando
        tenés un servicio en curso y volvés a <strong>Disponible</strong> al finalizarlo. Los
        servicios futuros no bloquean tu disponibilidad.
      </p>

      <section>
        <h2 className="font-display text-xl font-semibold">Resumen de hoy</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Servicios pendientes" value={String(summary.pending)} />
          <SummaryCard label="Servicios aceptados" value={String(summary.accepted)} />
          <SummaryCard label="Servicios finalizados" value={String(summary.finished)} />
          <SummaryCard
            label="Importes pendientes de cobrar"
            value={`${summary.pendingCollectionAmount.toLocaleString("es-AR")} ${summary.currency}`}
            hint={`${summary.pendingCollection} servicio(s)`}
          />
        </div>
      </section>

      {unread.length > 0 && (
        <section className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Bell className="h-4 w-4 text-gold" /> Nuevos servicios asignados (
              {unreadCount(notifications)})
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                run(
                  () => markAllNotificationsRead(unread.map((n) => n.id)),
                  "Avisos marcados como leídos",
                )
              }
            >
              Marcar todo como leído
            </Button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {unread.map((n) => {
              const p = assignmentPayload(n);
              return (
                <li key={n.id} className="rounded-xl border border-border/70 bg-card p-3">
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.service_date ?? "Sin fecha"} · {timeLabel(p.service_time ?? null)} ·{" "}
                    {(p.origin ?? "—") + " → " + (p.destination ?? "—")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pasajeros: {p.pax_count ?? "—"} · Equipaje: {p.luggage_count ?? "—"}
                    {p.collection_amount != null
                      ? ` · A cobrar: ${p.collection_amount} ${p.collection_currency ?? ""}`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl font-semibold">Mis servicios</h2>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as DriverFilter)} className="mt-4">
          <TabsList>
            <TabsTrigger value="today">Hoy ({counts.today})</TabsTrigger>
            <TabsTrigger value="upcoming">Próximos ({counts.upcoming})</TabsTrigger>
            <TabsTrigger value="history">Historial ({counts.history})</TabsTrigger>
          </TabsList>
          <TabsContent value={filter} className="mt-4 space-y-4">
            {visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay servicios en esta sección.</p>
            ) : (
              visible.map((s) => (
                <DriverServiceCard
                  key={s.id}
                  service={s}
                  ctx={context.get(s.id) ?? null}
                  vehicle={s.vehicle_resource_id ? vehicleById.get(s.vehicle_resource_id) : null}
                  busy={busy}
                  onAction={run}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </section>

    </div>
  );
}

function DriverServiceCard({
  service: s,
  ctx,
  vehicle,
  busy,
  onAction,
}: {
  service: TransportService;
  ctx: DriverServiceContext | null;
  vehicle: Resource | null | undefined;
  busy: boolean;
  onAction: (action: () => Promise<void>, message: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<string>(REJECTION_REASONS[0]);
  const [showReject, setShowReject] = useState(false);
  const [amount, setAmount] = useState(
    s.collection_amount != null ? String(s.collection_amount) : "",
  );
  const [history, setHistory] = useState<TransportServiceEvent[] | null>(null);

  const actions = nextDriverActions(s.status);
  const mustCollect = s.collection_status === "pending" || s.collection_status === "collected";

  async function toggleHistory() {
    if (history) {
      setHistory(null);
      return;
    }
    try {
      setHistory(await listServiceHistory(s.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el historial");
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {serviceTypeLabel(s.service_type)}
            {ctx?.booking_number ? ` · Reserva ${ctx.booking_number}` : ""}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {(s.origin ?? "—") + " → " + (s.destination ?? "—")}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {s.service_date ?? "Sin fecha"}
            {s.service_time ? ` · ${String(s.service_time).slice(0, 5)}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${serviceStatusClasses(s.status)}`}
        >
          {serviceStatusLabel(s.status)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</dt>
          <dd>{ctx?.client_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Pasajeros</dt>
          <dd>{s.pax_count ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Equipaje</dt>
          <dd>{s.luggage_count ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Vehículo</dt>
          <dd className="flex items-center gap-1.5">
            <CarFront className="h-3.5 w-3.5 text-gold" />
            {vehicle ? vehicleDescription(vehicle) : "Sin asignar"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Observaciones</dt>
          <dd className="whitespace-pre-line">{s.notes ?? "—"}</dd>
        </div>
      </dl>

      {/* Información de cobro */}
      <div className="mt-4 rounded-xl border border-border/70 bg-secondary/30 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <BadgeDollarSign className="h-4 w-4 text-gold" /> Información de cobro
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Modalidad</p>
            <p>{paymentModeLabel(s.payment_mode)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">A cobrar</p>
            <p>
              {s.collection_amount != null
                ? `${s.collection_amount} ${s.collection_currency}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
            <span
              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${collectionStatusClasses(s.collection_status)}`}
            >
              {collectionStatusLabel(s.collection_status)}
            </span>
          </div>
        </div>
        {s.collected_at && (
          <p className="mt-2 text-xs text-muted-foreground">
            Cobro confirmado el {fmt(s.collected_at)}
            {s.collected_amount != null ? ` · monto informado ${s.collected_amount}` : ""}
          </p>
        )}
        {mustCollect && s.collection_status !== "collected" && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Monto informado</Label>
              <Input
                className="w-40"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                onAction(
                  () => confirmCollection(s.id, amount.trim() === "" ? null : Number(amount)),
                  "Cobro confirmado",
                )
              }
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar cobro recibido
            </Button>
          </div>
        )}
      </div>

      {/* Flujo operativo */}
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {actions.map((a) => (
            <Button
              key={a.key}
              size="sm"
              variant={a.key === "reject" ? "outline" : "default"}
              disabled={busy}
              onClick={() => {
                if (a.key === "reject") {
                  setShowReject((v) => !v);
                  return;
                }
                const map = {
                  accept: () => acceptService(s.id),
                  start: () => startService(s.id),
                  arrive: () => arriveAtOrigin(s.id),
                  onboard: () => passengerOnboard(s.id),
                  complete: () => completeService(s.id),
                } as const;
                const fn = map[a.key as keyof typeof map];
                if (fn) onAction(fn, a.label);
              }}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}

      {showReject && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Motivo del rechazo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() =>
              onAction(async () => {
                await rejectService(s.id, reason);
                setShowReject(false);
              }, "Viaje rechazado")
            }
          >
            Confirmar rechazo
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="text-xs text-muted-foreground">
          Última actualización: {fmt(lastUpdateOf(s))}
        </span>
        <Button size="sm" variant="ghost" onClick={toggleHistory}>
          <History className="mr-2 h-4 w-4" /> {history ? "Ocultar historial" : "Ver historial"}
        </Button>
      </div>

      {history && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {history.length === 0 && <li>Sin eventos registrados.</li>}
          {history.map((h) => (
            <li key={h.id}>
              {fmt(h.created_at)} · {serviceStatusLabel(h.to_status)}
              {h.comment ? ` · ${h.comment}` : ""}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
