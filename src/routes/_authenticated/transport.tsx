import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Bus, CarFront, Loader2, MapPin, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunicationEventsPanel } from "@/components/communication-events-panel";
import {
  availabilityClasses,
  availabilityLabel,
  listResources,
  RESOURCE_AVAILABILITIES,
  type Resource,
  type ResourceAvailability,
} from "@/lib/resources";
import {
  computeTransportStats,
  coverageOf,
  driverFullName,
  isDriverResource,
  isVehicleResource,
  listTransportServices,
  markResourceAvailable,
  serviceStatusClasses,
  serviceStatusLabel,
  serviceTypeLabel,
  suggestTransportResources,
  TRANSPORT_SERVICE_TYPES,
  vehicleDescription,
  vehicleTypeLabel,
  type TransportService,
  type TransportServiceType,
} from "@/lib/transport";

export const Route = createFileRoute("/_authenticated/transport")({
  component: TransportPage,
  head: () => ({
    meta: [
      { title: "Red de transporte — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Vista operativa de la red de transporte: conductores, vehículos y servicios por ciudad, zona y fecha.",
      },
      { property: "og:title", content: "Red de transporte — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Conductores disponibles, vehículos y servicios pendientes o asignados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL = "all";

function TransportPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [services, setServices] = useState<TransportService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [city, setCity] = useState("");
  const [zone, setZone] = useState("");
  const [date, setDate] = useState("");
  const [serviceType, setServiceType] = useState<TransportServiceType | "all">(ALL);
  const [capacity, setCapacity] = useState("");
  const [availability, setAvailability] = useState<ResourceAvailability | "all">(ALL);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, svcs] = await Promise.all([
        listResources({ includeArchived: false }),
        listTransportServices({ date: date || undefined }),
      ]);
      setResources(res);
      setServices(svcs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la red de transporte");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = suggestTransportResources(resources, {
      origin: city || null,
      serviceType: serviceType === ALL ? null : serviceType,
      paxCount: capacity ? Number(capacity) : null,
    });
    if (zone.trim()) {
      const term = zone.trim().toLowerCase();
      rows = rows.filter((r) => coverageOf(r).some((c) => c.toLowerCase().includes(term)));
    }
    if (availability !== ALL) rows = rows.filter((r) => r.availability === availability);
    return rows;
  }, [resources, city, zone, serviceType, capacity, availability]);

  const drivers = filtered.filter(isDriverResource);
  const vehicles = filtered.filter(isVehicleResource);
  const stats = computeTransportStats(resources, services);

  const pending = services.filter((s) => s.status === "pending" || s.status === "requested");
  const assigned = services.filter(
    (s) => s.status === "assigned" || s.status === "accepted" || s.status === "in_transit",
  );

  async function markAvailable(r: Resource) {
    setSaving(true);
    try {
      await markResourceAvailable(r.id);
      toast.success(`${driverFullName(r)} está disponible`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="font-display text-3xl font-semibold">Red de transporte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conductores, vehículos y servicios distribuidos por ciudades y destinos. Los recursos se
          administran desde{" "}
          <Link to="/resources" className="text-primary hover:underline">
            Recursos Operativos
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Conductores disponibles" value={`${stats.driversAvailable}/${stats.drivers}`} />
        <Stat label="Conductores en viaje" value={stats.driversBusy} />
        <Stat label="Vehículos disponibles" value={`${stats.vehiclesAvailable}/${stats.vehicles}`} />
        <Stat label="Servicios pendientes" value={stats.pendingServices} />
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1">
          <Label className="text-xs">Ciudad</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Neuquén" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Zona / destino</Label>
          <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Bariloche" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo de servicio</Label>
          <Select value={serviceType} onValueChange={(v) => setServiceType(v as TransportServiceType | "all")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {TRANSPORT_SERVICE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Capacidad mínima</Label>
          <Input
            type="number"
            min={0}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Disponibilidad</Label>
          <Select
            value={availability}
            onValueChange={(v) => setAvailability(v as ResourceAvailability | "all")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {RESOURCE_AVAILABILITIES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando red...
        </div>
      ) : (
        <Tabs defaultValue="drivers">
          <TabsList>
            <TabsTrigger value="drivers">
              <UserRound className="mr-2 h-4 w-4" /> Conductores ({drivers.length})
            </TabsTrigger>
            <TabsTrigger value="vehicles">
              <CarFront className="mr-2 h-4 w-4" /> Vehículos ({vehicles.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              <Search className="mr-2 h-4 w-4" /> Pendientes ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="assigned">
              <Bus className="mr-2 h-4 w-4" /> Asignados ({assigned.length})
            </TabsTrigger>
            <TabsTrigger value="economics">
              <BadgeDollarSign className="mr-2 h-4 w-4" /> Economía
            </TabsTrigger>
          </TabsList>


          <TabsContent value="drivers">
            <div className="grid gap-4 md:grid-cols-2">
              {drivers.length === 0 && <Empty text="No hay conductores con estos filtros." />}
              {drivers.map((d) => (
                <div key={d.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        to="/resources/$id"
                        params={{ id: d.id }}
                        className="font-medium hover:text-primary"
                      >
                        {driverFullName(d)}
                      </Link>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {[d.base_city, d.state, d.country].filter(Boolean).join(", ") || "Sin base"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Opera en: {coverageOf(d).join(", ") || "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[d.whatsapp, d.email].filter(Boolean).join(" · ") || "Sin contacto"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${availabilityClasses(d.availability)}`}
                    >
                      {availabilityLabel(d.availability)}
                    </span>
                  </div>
                  <Button
                    className="mt-4 w-full"
                    size="sm"
                    disabled={saving || d.availability === "available"}
                    onClick={() => markAvailable(d)}
                  >
                    ESTOY DISPONIBLE
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="vehicles">
            <div className="grid gap-4 md:grid-cols-2">
              {vehicles.length === 0 && <Empty text="No hay vehículos con estos filtros." />}
              {vehicles.map((v) => (
                <div key={v.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        to="/resources/$id"
                        params={{ id: v.id }}
                        className="font-medium hover:text-primary"
                      >
                        {vehicleDescription(v)}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {vehicleTypeLabel(v.vehicle_type)}
                        {v.vehicle_plate ? ` · ${v.vehicle_plate}` : ""}
                        {v.vehicle_color ? ` · ${v.vehicle_color}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {v.pax_capacity != null ? `${v.pax_capacity} pax` : "Pax s/d"} ·{" "}
                        {v.luggage_capacity != null ? `${v.luggage_capacity} equipajes` : "Equipaje s/d"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Base: {v.base_city ?? "—"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${availabilityClasses(v.availability)}`}
                    >
                      {availabilityLabel(v.availability)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pending">
            <ServiceTable services={pending} />
          </TabsContent>
          <TabsContent value="assigned">
            <ServiceTable services={assigned} />
          </TabsContent>
          <TabsContent value="economics">
            <TransportEconomicsDashboard services={services} />
          </TabsContent>
        </Tabs>

      )}

      <CommunicationEventsPanel />
    </div>
  );
}

/** Panel económico global (v1.6): ventas, costos, margen y estados de cobro/liquidación. */
function TransportEconomicsDashboard({ services }: { services: TransportService[] }) {
  const { isAdmin } = useAccount();
  const analysisCurrency = useAnalysisCurrency();
  const metrics = useMemo(
    () => economicsSummary(services, analysisCurrency),
    [services, analysisCurrency],
  );

  const cards = [
    { label: `Ventas de transporte (${analysisCurrency})`, value: formatMoney(analysisCurrency, metrics.sales) },
    ...(isAdmin
      ? [
          { label: `Costos operativos (${analysisCurrency})`, value: formatMoney(analysisCurrency, metrics.costs) },
          {
            label: "Margen bruto ViaE",
            value: `${formatMoney(analysisCurrency, metrics.gross)}${
              metrics.percent != null ? ` · ${metrics.percent}%` : ""
            }`,
          },
        ]
      : []),
    { label: "Cobrado al pasajero", value: String(metrics.collected) },
    { label: "Cobros pendientes", value: String(metrics.pendingCollection) },
    ...(isAdmin
      ? [{ label: "Liquidaciones pendientes", value: String(metrics.pendingSettlement) }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>
      {metrics.excluded > 0 && (
        <p className="text-xs text-muted-foreground">
          {metrics.excluded} servicio(s) quedaron fuera de los totales por falta de tipo de cambio.
        </p>
      )}
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Los costos y márgenes sólo están disponibles para administradores.
        </p>
      )}
    </div>
  );
}


function ServiceTable({ services }: { services: TransportService[] }) {
  if (services.length === 0) return <Empty text="No hay servicios con estos filtros." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 pr-4">Servicio</th>
            <th className="py-2 pr-4">Trayecto</th>
            <th className="py-2 pr-4">Fecha</th>
            <th className="py-2 pr-4">Pax</th>
            <th className="py-2 pr-4">Estado</th>
            <th className="py-2">Reserva</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id} className="border-t border-border/60">
              <td className="py-2 pr-4 font-medium">{serviceTypeLabel(s.service_type)}</td>
              <td className="py-2 pr-4">
                {(s.origin ?? "—") + " → " + (s.destination ?? "—")}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {s.service_date ?? "—"}
                {s.service_time ? ` ${String(s.service_time).slice(0, 5)}` : ""}
              </td>
              <td className="py-2 pr-4">{s.pax_count ?? "—"}</td>
              <td className="py-2 pr-4">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${serviceStatusClasses(s.status)}`}
                >
                  {serviceStatusLabel(s.status)}
                </span>
              </td>
              <td className="py-2">
                {s.booking_id ? (
                  <Link
                    to="/bookings/$id"
                    params={{ id: s.booking_id }}
                    className="text-primary hover:underline"
                  >
                    Ver reserva
                  </Link>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
