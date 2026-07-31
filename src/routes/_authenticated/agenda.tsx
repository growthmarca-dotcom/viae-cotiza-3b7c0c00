import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CarFront, ChevronLeft, ChevronRight, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listResources, type Resource } from "@/lib/resources";
import {
  driverFullName,
  listTransportServices,
  serviceStatusClasses,
  serviceStatusLabel,
  serviceTypeLabel,
  vehicleDescription,
  type TransportService,
} from "@/lib/transport";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addDays,
  AGENDA_ALL,
  agendaFacets,
  applyAgendaFilters,
  endTimeLabel,
  formatDayLabel,
  groupAgenda,
  hoursLabel,
  listServiceBookingInfo,
  loadByDestination,
  loadByZone,
  servicesOfDay,
  sortByTime,
  timeLabel,
  todayISO,
  weekDays,
  type AgendaFilters,
  type ServiceBookingInfo,
} from "@/lib/transport-ops";


export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: "Agenda operativa de transporte — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Agenda diaria y semanal de los traslados: horario, origen, destino, cliente, conductor, vehículo y estado del servicio.",
      },
      { property: "og:title", content: "Agenda operativa de transporte — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Servicios del día, en curso, próximos y finalizados en una sola vista.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AgendaPage() {
  const [services, setServices] = useState<TransportService[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [info, setInfo] = useState<Map<string, ServiceBookingInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(todayISO());
  const [filters, setFilters] = useState<AgendaFilters>({});


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [svcs, res] = await Promise.all([listTransportServices({}), listResources({})]);
      setServices(svcs);
      setResources(res);
      setInfo(
        await listServiceBookingInfo(
          svcs.map((s) => s.booking_id).filter(Boolean) as string[],
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la agenda");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const facets = useMemo(() => agendaFacets(services), [services]);
  const filtered = useMemo(() => applyAgendaFilters(services, filters), [services, filters]);
  const groups = useMemo(() => groupAgenda(filtered), [filtered]);
  const week = useMemo(() => weekDays(day), [day]);
  const zoneLoad = useMemo(() => loadByZone(filtered), [filtered]);
  const destinationLoad = useMemo(() => loadByDestination(filtered).slice(0, 8), [filtered]);
  const driverOptions = useMemo(
    () => resources.filter((r) => r.category === "driver"),
    [resources],
  );
  const vehicleOptions = useMemo(
    () => resources.filter((r) => r.category === "vehicle"),
    [resources],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando agenda...
      </div>
    );
  }

  const row = (s: TransportService) => (
    <ServiceRow key={s.id} service={s} info={info.get(s.booking_id ?? "") ?? null} byId={byId} />
  );

  const setFilter = (key: keyof AgendaFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-8 pb-16">
      <header>
        <h1 className="font-display text-3xl font-semibold">Agenda operativa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Traslados del día, en curso, próximos y finalizados. Vista por día o por semana.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Hoy" value={groups.today.length} />
        <Metric label="En curso" value={groups.running.length} />
        <Metric label="Próximos" value={groups.upcoming.length} />
        <Metric label="Finalizados" value={groups.finished.length} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Filtros operativos</h2>
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
            Limpiar filtros
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect
            label="Provincia / Región"
            value={filters.state}
            options={facets.states}
            onChange={(v) => setFilter("state", v)}
          />
          <FilterSelect
            label="Ciudad"
            value={filters.city}
            options={facets.cities}
            onChange={(v) => setFilter("city", v)}
          />
          <FilterSelect
            label="Zona turística"
            value={filters.zone}
            options={facets.zones}
            onChange={(v) => setFilter("zone", v)}
          />
          <FilterSelect
            label="Conductor"
            value={filters.driverResourceId}
            options={driverOptions.map((r) => ({ value: r.id, label: driverFullName(r) }))}
            onChange={(v) => setFilter("driverResourceId", v)}
          />
          <FilterSelect
            label="Vehículo"
            value={filters.vehicleResourceId}
            options={vehicleOptions.map((r) => ({ value: r.id, label: vehicleDescription(r) }))}
            onChange={(v) => setFilter("vehicleResourceId", v)}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <LoadBlock title="Carga operativa por zona" buckets={zoneLoad} />
        <LoadBlock title="Carga operativa por destino" buckets={destinationLoad} />
      </div>

      <Tabs defaultValue="day">
        <TabsList>
          <TabsTrigger value="day">Día</TabsTrigger>
          <TabsTrigger value="week">Semana</TabsTrigger>
          <TabsTrigger value="lists">Por estado</TabsTrigger>
        </TabsList>


        <TabsContent value="day" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" size="icon" onClick={() => setDay((d) => addDays(d, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" size="icon" onClick={() => setDay((d) => addDays(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDay(todayISO())}>
              <CalendarDays className="mr-2 h-4 w-4" /> Hoy
            </Button>
          </div>
          <DayBlock title={formatDayLabel(day)} services={servicesOfDay(filtered, day)} render={row} />
        </TabsContent>

        <TabsContent value="week" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setDay((d) => addDays(d, -7))}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Semana anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDay((d) => addDays(d, 7))}>
              Semana siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {week.map((d) => (
              <DayBlock
                key={d}
                title={formatDayLabel(d)}
                services={servicesOfDay(filtered, d)}
                render={row}
                compact
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="lists" className="mt-4 space-y-6">
          <DayBlock title="Servicios en curso" services={sortByTime(groups.running)} render={row} />
          <DayBlock title="Servicios del día" services={sortByTime(groups.today)} render={row} />
          <DayBlock title="Próximos servicios" services={sortByTime(groups.upcoming)} render={row} />
          <DayBlock
            title="Servicios finalizados"
            services={sortByTime(groups.finished).slice(0, 30)}
            render={row}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type FilterOption = string | { value: string; label: string };

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value ?? AGENDA_ALL} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AGENDA_ALL}>Todos</SelectItem>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LoadBlock({
  title,
  buckets,
}: {
  title: string;
  buckets: { key: string; count: number; minutes: number }[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {buckets.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin servicios para los filtros actuales.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {buckets.map((b) => (
            <li key={b.key} className="flex items-center justify-between gap-3">
              <span className="truncate">{b.key}</span>
              <span className="text-muted-foreground">
                {b.count} servicio{b.count === 1 ? "" : "s"} · {hoursLabel(b.minutes)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function DayBlock({
  title,
  services,
  render,
  compact,
}: {
  title: string;
  services: TransportService[];
  render: (s: TransportService) => React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className={compact ? "font-medium capitalize" : "font-display text-lg font-semibold capitalize"}>
        {title}
      </h2>
      <div className="mt-3 space-y-2">
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin servicios.</p>
        ) : (
          services.map(render)
        )}
      </div>
    </section>
  );
}

function ServiceRow({
  service: s,
  info,
  byId,
}: {
  service: TransportService;
  info: ServiceBookingInfo | null;
  byId: Map<string, Resource>;
}) {
  const driver = s.driver_resource_id ? byId.get(s.driver_resource_id) : null;
  const vehicle = s.vehicle_resource_id ? byId.get(s.vehicle_resource_id) : null;
  return (
    <div className="grid gap-2 rounded-xl border border-border/70 bg-secondary/20 p-3 text-sm sm:grid-cols-[64px_1fr_auto]">
      <div className="text-xs">
        <p className="text-sm font-medium">{timeLabel(s.service_time)}</p>
        <p className="text-muted-foreground">
          {endTimeLabel(s.service_time ? String(s.service_time) : null, s.duration_minutes) ?? "—"}
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium">
          {(s.origin ?? "—") + " → " + (s.destination ?? "—")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {serviceTypeLabel(s.service_type)}
          {info?.client_name ? ` · ${info.client_name}` : ""}
          {info?.booking_number ? ` · ${info.booking_number}` : ""}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5 text-gold" />
            {driver ? driverFullName(driver) : "Sin conductor"}
          </span>
          <span className="flex items-center gap-1">
            <CarFront className="h-3.5 w-3.5 text-gold" />
            {vehicle ? vehicleDescription(vehicle) : "Sin vehículo"}
          </span>
        </p>
      </div>
      <span
        className={`h-fit rounded-full border px-2.5 py-0.5 text-xs ${serviceStatusClasses(s.status)}`}
      >
        {serviceStatusLabel(s.status)}
      </span>
    </div>
  );
}
