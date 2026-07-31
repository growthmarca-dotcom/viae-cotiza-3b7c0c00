import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { agentFullName, type Agent } from "@/lib/agents";
import {
  COMPANY_KINDS,
  EMPTY_RESOURCE,
  RECORD_STATUSES,
  RESOURCE_AVAILABILITIES,
  RESOURCE_CATEGORIES,
  RESOURCE_SPECIALTIES,
  RESOURCE_ZONES,
  type Company,
  type CompanyKind,
  type RecordStatus,
  type ResourceAvailability,
  type ResourceCategory,
  type ResourceInput,
} from "@/lib/resources";
import {
  TRANSPORT_SERVICE_TYPES,
  VEHICLE_TYPES,
  type TransportServiceType,
  type VehicleType,
} from "@/lib/transport";
import {
  RESOURCE_CLASSES,
  RESOURCE_OWNER_TYPES,
  RESOURCE_SUBTYPES,
  VEHICLE_FUELS,
  VEHICLE_TRANSMISSIONS,
  type ResourceClass,
  type ResourceOwnerType,
} from "@/lib/resource-catalog";
import {
  citiesOf,
  cityNamesOf,
  DEFAULT_COUNTRY,
  GEO_COUNTRIES,
  regionLabelOf,
  regionsOf,
  zonesOf,
} from "@/lib/geo";


const NONE_GEO = "__none_geo__";




type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ResourceInput;
  companies: Company[];
  agents: Agent[];
  title: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: ResourceInput) => void | Promise<void>;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
      {children}
    </h3>
  );
}

const NONE = "__none__";

/** Convierte "Bariloche, Neuquén" en un listado limpio. */
function parseList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}


export function ResourceFormDialog({
  open,
  onOpenChange,
  initial,
  companies,
  agents,
  title,
  submitLabel,
  submitting,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<ResourceInput>(initial ?? EMPTY_RESOURCE);

  useEffect(() => {
    if (open) setForm(initial ?? EMPTY_RESOURCE);
  }, [open, initial]);

  function set<K extends keyof ResourceInput>(key: K, value: ResourceInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleIn(key: "zones" | "specialties", value: string) {
    setForm((f) => {
      const current = f[key];
      return {
        ...f,
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  function toggleGeo(key: "cities_served" | "tourist_zones" | "destinations", value: string) {
    setForm((f) => {
      const current = f[key];
      return {
        ...f,
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  const geoCountry = form.country || DEFAULT_COUNTRY;
  const geoRegions = regionsOf(geoCountry);
  const geoCities = citiesOf(geoCountry, form.state || null);
  const geoCountryCities = cityNamesOf(geoCountry);
  const geoZones = zonesOf(geoCountry);

  function toggleServiceType(value: TransportServiceType) {
    setForm((f) => ({
      ...f,
      transport_service_types: f.transport_service_types.includes(value)
        ? f.transport_service_types.filter((v) => v !== value)
        : [...f.transport_service_types, value],
    }));
  }

  const isDriver = form.category === "driver" || form.subtype === "driver";
  const isVehicle = form.category === "vehicle" || form.resource_class === "vehicle";
  const isTransport =
    ["driver", "vehicle", "taxi", "transfer"].includes(form.category) ||
    form.resource_class === "vehicle" ||
    isDriver;
  const subtypes = RESOURCE_SUBTYPES[form.resource_class] ?? [];


  return (

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>
            Un recurso es todo aquello que puede asignarse a una reserva: alojamientos, vehículos,
            guías, excursiones, seguros o agentes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Clasificación</Label>
            <Select
              value={form.resource_class}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, resource_class: v as ResourceClass, subtype: "" }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_CLASSES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {RESOURCE_CLASSES.find((c) => c.value === form.resource_class)?.hint}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Subtipo</Label>
            <Select
              value={form.subtype || NONE}
              onValueChange={(v) => set("subtype", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin definir</SelectItem>
                {subtypes.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select
              value={form.category}
              onValueChange={(v) => set("category", v as ResourceCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Origen</Label>
            <Select value={form.kind} onValueChange={(v) => set("kind", v as CompanyKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
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

          <div className="space-y-2">
            <Label>Agente vinculado</Label>
            <Select
              value={form.agent_id || NONE}
              onValueChange={(v) => set("agent_id", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin agente</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {agentFullName(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SectionTitle>Propietario del recurso</SectionTitle>
          <div className="space-y-2">
            <Label>Propietario</Label>
            <Select
              value={form.owner_type}
              onValueChange={(v) => set("owner_type", v as ResourceOwnerType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_OWNER_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Proveedor / empresa relacionada</Label>
            <Select
              value={form.owner_company_id || NONE}
              onValueChange={(v) => set("owner_company_id", v === NONE ? "" : v)}
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
            <Label>Titular (si es particular u otro)</Label>
            <Input
              value={form.owner_name}
              onChange={(e) => set("owner_name", e.target.value)}
              placeholder="Nombre del titular"
            />
          </div>


          <div className="space-y-2 sm:col-span-2">
            <Label>Descripción</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <SectionTitle>Contacto</SectionTitle>
          <div className="space-y-2">
            <Label>Referente</Label>
            <Input
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Zona principal</Label>
            <Input
              value={form.main_zone}
              onChange={(e) => set("main_zone", e.target.value)}
              placeholder="Bariloche, Patagonia..."
            />
          </div>

          <SectionTitle>Capacidad y disponibilidad</SectionTitle>
          <div className="space-y-2">
            <Label>Capacidad (pax)</Label>
            <Input
              type="number"
              min={0}
              value={form.pax_capacity}
              onChange={(e) => set("pax_capacity", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Unidades / habitaciones</Label>
            <Input
              type="number"
              min={0}
              value={form.unit_count}
              onChange={(e) => set("unit_count", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Límite operativo diario</Label>
            <Input
              type="number"
              min={0}
              value={form.operating_limit}
              onChange={(e) => set("operating_limit", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Disponibilidad</Label>
            <Select
              value={form.availability}
              onValueChange={(v) => set("availability", v as ResourceAvailability)}
            >
              <SelectTrigger>
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
          </div>
          <div className="space-y-2">
            <Label>Estado del registro</Label>
            <Select
              value={form.record_status}
              onValueChange={(v) => set("record_status", v as RecordStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SectionTitle>Ubicación operativa</SectionTitle>
          <div className="space-y-2">
            <Label>País</Label>
            <Select
              value={form.country || DEFAULT_COUNTRY}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  country: v,
                  state: "",
                  base_city: "",
                  cities_served: [],
                  tourist_zones: [],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEO_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.name}>
                    {c.name}
                    {c.regions.length === 0 ? " (catálogo pendiente)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{regionLabelOf(form.country || DEFAULT_COUNTRY)}</Label>
            {geoRegions.length > 0 ? (
              <Select
                value={form.state || NONE_GEO}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, state: v === NONE_GEO ? "" : v, base_city: "" }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin definir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_GEO}>Sin definir</SelectItem>
                  {geoRegions.map((r) => (
                    <SelectItem key={r.name} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
            )}
          </div>
          <div className="space-y-2">
            <Label>Ciudad base</Label>
            {geoCities.length > 0 ? (
              <Select
                value={form.base_city || NONE_GEO}
                onValueChange={(v) => set("base_city", v === NONE_GEO ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin definir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_GEO}>Sin definir</SelectItem>
                  {geoCities.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.base_city}
                onChange={(e) => set("base_city", e.target.value)}
                placeholder="Neuquén Capital"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Distancia máxima de operación (km)</Label>
            <Input
              type="number"
              min={0}
              value={form.max_distance_km}
              onChange={(e) => set("max_distance_km", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Ciudades donde opera</Label>
            {geoCountryCities.length > 0 ? (
              <div className="flex flex-wrap gap-3 rounded-lg border border-border/70 p-3">
                {geoCountryCities.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.cities_served.includes(c)}
                      onCheckedChange={() => toggleGeo("cities_served", c)}
                    />
                    {c}
                  </label>
                ))}
              </div>
            ) : (
              <Input
                value={form.cities_served.join(", ")}
                onChange={(e) => set("cities_served", parseList(e.target.value))}
                placeholder="San Martín de los Andes, Villa La Angostura, Bariloche"
              />
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Zonas turísticas donde opera</Label>
            {geoZones.length > 0 ? (
              <div className="flex flex-wrap gap-3 rounded-lg border border-border/70 p-3">
                {geoZones.map((z) => (
                  <label key={z} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.tourist_zones.includes(z)}
                      onCheckedChange={() => toggleGeo("tourist_zones", z)}
                    />
                    {z}
                  </label>
                ))}
              </div>
            ) : (
              <Input
                value={form.tourist_zones.join(", ")}
                onChange={(e) => set("tourist_zones", parseList(e.target.value))}
                placeholder="Lagos del Sur, Aeropuertos regionales"
              />
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Destinos habilitados</Label>
            <Input
              value={form.destinations.join(", ")}
              onChange={(e) => set("destinations", parseList(e.target.value))}
              placeholder="Aeropuerto Chapelco, Aeropuerto Bariloche, Cerro Catedral"
            />
            <p className="text-xs text-muted-foreground">
              Puntos concretos de trabajo. Separá cada destino con una coma.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Anticipación mínima (horas)</Label>
            <Input
              type="number"
              min={0}
              value={form.advance_notice_hours}
              onChange={(e) => set("advance_notice_hours", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Checkbox
              checked={form.requires_advance_booking}
              onCheckedChange={(v) => set("requires_advance_booking", v === true)}
            />
            Necesita reserva previa
          </label>

          {isTransport && (
            <>
              <SectionTitle>Servicios de transporte que presta</SectionTitle>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                {TRANSPORT_SERVICE_TYPES.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.transport_service_types.includes(t.value)}
                      onCheckedChange={() => toggleServiceType(t.value)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </>
          )}

          {isDriver && (
            <>
              <SectionTitle>Datos del conductor</SectionTitle>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={form.driver_first_name}
                  onChange={(e) => set("driver_first_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input
                  value={form.driver_last_name}
                  onChange={(e) => set("driver_last_name", e.target.value)}
                />
              </div>
            </>
          )}

          {isVehicle && (
            <>
              <SectionTitle>Datos del vehículo</SectionTitle>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input
                  value={form.vehicle_brand}
                  onChange={(e) => set("vehicle_brand", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input
                  value={form.vehicle_model}
                  onChange={(e) => set("vehicle_model", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Versión</Label>
                <Input
                  value={form.vehicle_version}
                  onChange={(e) => set("vehicle_version", e.target.value)}
                  placeholder="XEI 1.8 CVT"
                />
              </div>
              <div className="space-y-2">
                <Label>Año</Label>
                <Input
                  type="number"
                  min={1950}
                  value={form.vehicle_year}
                  onChange={(e) => set("vehicle_year", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Patente</Label>
                <Input
                  value={form.vehicle_plate}
                  onChange={(e) => set("vehicle_plate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  value={form.vehicle_color}
                  onChange={(e) => set("vehicle_color", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Combustible</Label>
                <Select
                  value={form.vehicle_fuel || NONE}
                  onValueChange={(v) => set("vehicle_fuel", v === NONE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin definir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin definir</SelectItem>
                    {VEHICLE_FUELS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Transmisión</Label>
                <Select
                  value={form.vehicle_transmission || NONE}
                  onValueChange={(v) => set("vehicle_transmission", v === NONE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin definir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin definir</SelectItem>
                    {VEHICLE_TRANSMISSIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de vehículo</Label>
                <Select
                  value={form.vehicle_type || NONE}
                  onValueChange={(v) => set("vehicle_type", v === NONE ? "" : (v as VehicleType))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin definir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin definir</SelectItem>
                    {VEHICLE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacidad de equipaje (total)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.luggage_capacity}
                  onChange={(e) => set("luggage_capacity", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Equipaje grande</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.large_luggage_capacity}
                  onChange={(e) => set("large_luggage_capacity", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Equipaje de mano</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.cabin_luggage_capacity}
                  onChange={(e) => set("cabin_luggage_capacity", e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Checkbox
                  checked={form.is_accessible}
                  onCheckedChange={(v) => set("is_accessible", v === true)}
                />
                Accesibilidad
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Checkbox
                  checked={form.has_air_conditioning}
                  onCheckedChange={(v) => set("has_air_conditioning", v === true)}
                />
                Aire acondicionado
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Checkbox
                  checked={form.self_drive}
                  onCheckedChange={(v) => set("self_drive", v === true)}
                />
                Sin conductor (rent a car)
              </label>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observaciones del vehículo</Label>
                <Textarea
                  rows={2}
                  value={form.vehicle_notes}
                  onChange={(e) => set("vehicle_notes", e.target.value)}
                />
              </div>
            </>

          )}

          <SectionTitle>Zonas de cobertura</SectionTitle>

          <div className="flex flex-wrap gap-3 sm:col-span-2">
            {RESOURCE_ZONES.map((z) => (
              <label key={z} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.zones.includes(z)}
                  onCheckedChange={() => toggleIn("zones", z)}
                />
                {z}
              </label>
            ))}
          </div>

          <SectionTitle>Especialidades</SectionTitle>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            {RESOURCE_SPECIALTIES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.specialties.includes(s)}
                  onCheckedChange={() => toggleIn("specialties", s)}
                />
                {s}
              </label>
            ))}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Observaciones internas</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSubmit(form)}
            disabled={submitting || form.name.trim().length === 0}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
