import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, Loader2, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  availabilityLabel,
  listCompanies,
  listResources,
  type Company,
  type Resource,
} from "@/lib/resources";
import {
  archiveTransportService,
  createTransportService,
  driverFullName,
  EMPTY_TRANSPORT_SERVICE,
  isDriverResource,
  isVehicleResource,
  listBookingTransportServices,
  listTransportServices,
  serviceStatusClasses,
  serviceStatusLabel,
  serviceTypeLabel,
  setTransportServiceStatus,
  suggestTransportResources,
  TRANSPORT_SERVICE_STATUSES,
  TRANSPORT_SERVICE_TYPES,
  vehicleDescription,
  type TransportService,
  type TransportServiceInput,
  type TransportServiceStatus,
  type TransportServiceType,
} from "@/lib/transport";
import {
  assignmentWarnings,
  futureServicesOf,
  resourceHeadline,
  timeLabel,
  type AssignmentWarning,
} from "@/lib/transport-ops";
import {
  addMinutesToTime,
  coverageOf,
  defaultDurationFor,
  durationLabel,
  estimatedEndOf,
  formatStamp,
  listActorNames,
} from "@/lib/transport";
import { citiesOf, DEFAULT_COUNTRY, regionsOf, zonesOf, zonesOfCity } from "@/lib/geo";
import { ServiceEconomicsPanel } from "@/components/service-economics-panel";
import { ServiceExtrasPanel } from "@/components/service-extras-panel";

import { useAccount } from "@/hooks/use-account";


const NONE = "__none__";

/**
 * Servicios de transporte requeridos por una reserva.
 * Los conductores, vehículos y empresas provienen del módulo Recursos
 * Operativos: acá sólo se solicitan, asignan y siguen sus estados.
 */
export function BookingTransportTab({ bookingId }: { bookingId: string }) {
  // v1.8: solicitar y asignar traslados es tarea de la central operativa.
  const { isOperations } = useAccount();
  const [services, setServices] = useState<TransportService[]>([]);
  const [allServices, setAllServices] = useState<TransportService[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState<TransportServiceInput>(EMPTY_TRANSPORT_SERVICE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [svcs, res, comps, all] = await Promise.all([
        listBookingTransportServices(bookingId),
        listResources(),
        listCompanies(true),
        listTransportServices({}),
      ]);
      setServices(svcs);
      setResources(res);
      setCompanies(comps);
      setAllServices(all);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el transporte");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  function set<K extends keyof TransportServiceInput>(key: K, value: TransportServiceInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Candidatos sugeridos (sin asignación automática: decide una persona).
  const candidates = useMemo(
    () =>
      suggestTransportResources(resources, {
        origin: form.origin,
        destination: form.destination,
        serviceType: form.service_type,
        paxCount: form.pax_count ? Number(form.pax_count) : null,
        luggageCount: form.luggage_count ? Number(form.luggage_count) : null,
      }),
    [resources, form.origin, form.destination, form.service_type, form.pax_count, form.luggage_count],
  );

  const drivers = candidates.filter(isDriverResource);
  const vehicles = candidates.filter(isVehicleResource);
  const byId = new Map(resources.map((r) => [r.id, r]));

  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let active = true;
    listActorNames(services.map((s) => s.last_updated_by)).then((m) => {
      if (active) setActorNames(m);
    });
    return () => {
      active = false;
    };
  }, [services]);


  const companyById = new Map(companies.map((c) => [c.id, c]));

  // Control de asignación (v1.3 · duración estimada v1.4): informa, nunca bloquea.
  const assignCtx = {
    date: form.service_date || null,
    time: form.service_time || null,
    durationMinutes: form.duration_minutes
      ? Number(form.duration_minutes)
      : defaultDurationFor(form.service_type),
    paxCount: form.pax_count ? Number(form.pax_count) : null,
    luggageCount: form.luggage_count ? Number(form.luggage_count) : null,
    origin: form.origin || null,
  };

  const selectedDriver = form.driver_resource_id ? byId.get(form.driver_resource_id) : undefined;
  const selectedVehicle = form.vehicle_resource_id ? byId.get(form.vehicle_resource_id) : undefined;
  const driverWarnings = selectedDriver
    ? assignmentWarnings(selectedDriver, allServices, assignCtx)
    : [];
  const vehicleWarnings = selectedVehicle
    ? assignmentWarnings(selectedVehicle, allServices, assignCtx)
    : [];


  async function create() {
    setSaving(true);
    try {
      await createTransportService(bookingId, form);
      toast.success("Servicio de transporte agregado");
      setForm(EMPTY_TRANSPORT_SERVICE);
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el servicio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Servicios de transporte</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOperations
              ? "Traslados, transfers y taxis de la red asignados a esta reserva."
              : "Traslados de la reserva. La solicitud y asignación las gestiona la central operativa."}
          </p>
        </div>
        {isOperations && (
          <Button size="sm" variant={showForm ? "outline" : "default"} onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" /> {showForm ? "Cancelar" : "Nuevo servicio"}
          </Button>
        )}
      </div>

      {isOperations && showForm && (
        <div className="mt-6 grid gap-4 rounded-xl border border-border/70 bg-secondary/30 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Servicio solicitado</Label>
            <Select
              value={form.service_type}
              onValueChange={(v) => set("service_type", v as TransportServiceType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_SERVICE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estado del servicio</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as TransportServiceStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_SERVICE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Origen</Label>
            <Input value={form.origin} onChange={(e) => set("origin", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Destino</Label>
            <Input value={form.destination} onChange={(e) => set("destination", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={form.service_date}
              onChange={(e) => set("service_date", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Hora de inicio</Label>
            <Input
              type="time"
              value={form.service_time}
              onChange={(e) => set("service_time", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Duración estimada (minutos)</Label>
            <Input
              type="number"
              min={0}
              step={5}
              value={form.duration_minutes}
              onChange={(e) => set("duration_minutes", e.target.value)}
              placeholder={String(defaultDurationFor(form.service_type))}
            />
          </div>
          <div className="space-y-2">
            <Label>Finalización estimada</Label>
            <Input
              readOnly
              value={
                addMinutesToTime(
                  form.service_time || null,
                  form.duration_minutes ? Number(form.duration_minutes) : null,
                ) ?? "--:--"
              }
              className="bg-secondary/40"
            />
          </div>
          <div className="space-y-2">
            <Label>Provincia / Región</Label>
            <Select
              value={form.state || NONE}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  state: v === NONE ? "" : v,
                  city: "",
                  tourist_zone: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin definir</SelectItem>
                {regionsOf(form.country || DEFAULT_COUNTRY).map((r) => (
                  <SelectItem key={r.name} value={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ciudad / Localidad</Label>
            <Select
              value={form.city || NONE}
              onValueChange={(v) => set("city", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin definir</SelectItem>
                {citiesOf(form.country || DEFAULT_COUNTRY, form.state || null).map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Zona turística</Label>
            <Select
              value={form.tourist_zone || NONE}
              onValueChange={(v) => set("tourist_zone", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin definir</SelectItem>
                {(form.city
                  ? zonesOfCity(form.city)
                  : zonesOf(form.country || DEFAULT_COUNTRY, form.state || null)
                ).map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pasajeros</Label>
            <Input
              type="number"
              min={0}
              value={form.pax_count}
              onChange={(e) => set("pax_count", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Equipaje</Label>
            <Input
              type="number"
              min={0}
              value={form.luggage_count}
              onChange={(e) => set("luggage_count", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Conductor asignado</Label>
            <Select
              value={form.driver_resource_id || NONE}
              onValueChange={(v) => set("driver_resource_id", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {driverFullName(d)}
                    {d.base_city ? ` · ${d.base_city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vehículo asignado</Label>
            <Select
              value={form.vehicle_resource_id || NONE}
              onValueChange={(v) => set("vehicle_resource_id", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {vehicleDescription(v)}
                    {v.pax_capacity != null ? ` · ${v.pax_capacity} pax` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(selectedDriver || selectedVehicle) && (
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
              {selectedDriver && (
                <AssignmentCheck
                  resource={selectedDriver}
                  warnings={driverWarnings}
                  services={allServices}
                />
              )}
              {selectedVehicle && (
                <AssignmentCheck
                  resource={selectedVehicle}
                  warnings={vehicleWarnings}
                  services={allServices}
                />
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Empresa asignada</Label>
            <Select
              value={form.company_id || NONE}
              onValueChange={(v) => set("company_id", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin empresa</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Observaciones</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agregar servicio
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Cargando servicios...</p>
      ) : services.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Esta reserva todavía no requiere servicios de transporte.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {services.map((s) => (
            <div key={s.id} className="rounded-xl border border-border/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <RouteIcon className="h-4 w-4 text-gold" />
                    {serviceTypeLabel(s.service_type)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {(s.origin ?? "—") + " → " + (s.destination ?? "—")}
                    {s.service_date ? ` · ${s.service_date}` : ""}
                    {s.service_time ? ` ${String(s.service_time).slice(0, 5)}` : ""}
                    {estimatedEndOf(s) ? ` → ${estimatedEndOf(s)}` : ""}
                    {s.duration_minutes != null ? ` (${durationLabel(s.duration_minutes)})` : ""}
                  </p>
                  {(s.city || s.state || s.tourist_zone) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[s.city, s.state, s.tourist_zone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.pax_count != null ? `${s.pax_count} pax` : "Pax s/d"} ·{" "}
                    {s.luggage_count != null ? `${s.luggage_count} equipajes` : "Equipaje s/d"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Última actualización: {formatStamp(s.last_status_at)}
                    {s.last_updated_by
                      ? ` · por ${actorNames.get(s.last_updated_by) ?? "usuario del sistema"}`
                      : ""}
                  </p>

                  <p className="mt-1 text-sm">
                    Chofer:{" "}
                    {s.driver_resource_id
                      ? (() => {
                          const d = byId.get(s.driver_resource_id);
                          return d ? driverFullName(d) : "—";
                        })()
                      : "sin asignar"}{" "}
                    · Vehículo:{" "}
                    {s.vehicle_resource_id
                      ? (() => {
                          const v = byId.get(s.vehicle_resource_id);
                          return v ? vehicleDescription(v) : "—";
                        })()
                      : "sin asignar"}
                    {s.company_id ? ` · ${companyById.get(s.company_id)?.name ?? ""}` : ""}
                  </p>
                  {s.notes && <p className="mt-1 text-sm whitespace-pre-line">{s.notes}</p>}
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${serviceStatusClasses(s.status)}`}
                >
                  {serviceStatusLabel(s.status)}
                </span>
              </div>

              <ServiceEconomicsPanel service={s} onSaved={load} />

              <ServiceExtrasPanel serviceId={s.id} />


              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">

                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Cambiar estado
                </span>
                {TRANSPORT_SERVICE_STATUSES.map((st) => (
                  <Button
                    key={st.value}
                    size="sm"
                    variant={st.value === s.status ? "default" : "outline"}
                    disabled={saving || st.value === s.status}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await setTransportServiceStatus(s.id, st.value);
                        toast.success(`Servicio: ${st.label}`);
                        await load();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {st.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={async () => {
                    await archiveTransportService(s.id);
                    toast.success("Servicio archivado");
                    load();
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Archivar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Ficha de control previa a la asignación (v1.3).
 * Muestra disponibilidad, ciudad base, cobertura, capacidad y los servicios
 * futuros del recurso, junto con las advertencias detectadas. Nunca bloquea.
 */
function AssignmentCheck({
  resource,
  warnings,
  services,
}: {
  resource: Resource;
  warnings: AssignmentWarning[];
  services: TransportService[];
}) {
  const future = futureServicesOf(services, resource.id).slice(0, 4);
  const coverage = coverageOf(resource);
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm">
      <p className="font-medium">{resourceHeadline(resource)}</p>
      <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
        <div>Disponibilidad: {availabilityLabel(resource.availability)}</div>
        <div>Ciudad base: {resource.base_city || "—"}</div>
        <div>Cobertura: {coverage.length > 0 ? coverage.join(", ") : "—"}</div>
        <div>
          Capacidad: {resource.pax_capacity != null ? `${resource.pax_capacity} pax` : "—"}
          {resource.luggage_capacity != null ? ` · ${resource.luggage_capacity} equipajes` : ""}
        </div>
      </dl>

      <p className="mt-3 text-xs font-medium">Servicios futuros asignados</p>
      {future.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin servicios futuros.</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {future.map((f) => (
            <li key={f.id}>
              {f.service_date ?? "s/f"} · {timeLabel(f.service_time)} · {f.origin ?? "—"} →{" "}
              {f.destination ?? "—"}
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {warnings.map((w, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                w.level === "warning"
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "border-gold/40 bg-gold/5 text-foreground"
              }`}
            >
              {w.level === "warning" ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
