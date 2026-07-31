import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { MultiSelect } from "@/components/multi-select";
import { agentFullName, type Agent } from "@/lib/agents";
import { listProviders } from "@/lib/providers";
import {
  COMPANY_KINDS,
  COVERAGE_SCOPES,
  EMPTY_RESOURCE,
  RECORD_STATUSES,
  RENTAL_FUEL_POLICIES,
  RENTAL_LICENSES,
  RENTAL_VEHICLE_CONDITIONS,
  RESOURCE_CATEGORIES,
  RESOURCE_SPECIALTIES,
  RESOURCE_ZONES,
  availabilityOptionsFor,
  validateResource,
  type Company,
  type CompanyKind,
  type CoverageScope,
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
  cityNamesOf,
  DEFAULT_COUNTRY,
  GEO_COUNTRIES,
  regionLabelOf,
  regionsOf,
  zonesOfCities,
} from "@/lib/geo";

const NONE = "__none__";
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

/** Campo compacto reutilizable dentro de cada bloque. */
function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Block({
  value,
  title,
  summary,
  children,
}: {
  value: string;
  title: string;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-xl border border-border bg-card px-4">
      <AccordionTrigger className="py-3 hover:no-underline">
        <span className="grid min-w-0 text-left">
          <span className="font-display text-base font-semibold">{title}</span>
          {summary && <span className="truncate text-xs text-muted-foreground">{summary}</span>}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="grid gap-4 pb-2 sm:grid-cols-2">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

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

  const { data: providers = [] } = useQuery({
    queryKey: ["providers", "select"],
    enabled: open,
    queryFn: () => listProviders({ status: "active" }),
  });

  useEffect(() => {
    if (open) setForm(initial ?? EMPTY_RESOURCE);
  }, [open, initial]);

  function set<K extends keyof ResourceInput>(key: K, value: ResourceInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleServiceType(value: TransportServiceType) {
    setForm((f) => ({
      ...f,
      transport_service_types: f.transport_service_types.includes(value)
        ? f.transport_service_types.filter((v) => v !== value)
        : [...f.transport_service_types, value],
    }));
  }

  const geoCountry = form.country || DEFAULT_COUNTRY;
  const geoRegions = regionsOf(geoCountry);
  const regionCities = useMemo(
    () => cityNamesOf(geoCountry, form.state || null),
    [geoCountry, form.state],
  );
  const countryCities = useMemo(() => cityNamesOf(geoCountry), [geoCountry]);
  /** Las zonas se filtran automáticamente por las ciudades elegidas. */
  const zoneOptions = useMemo(
    () =>
      zonesOfCities([form.base_city, ...form.cities_served].filter(Boolean), {
        country: geoCountry,
        region: form.state,
      }),
    [form.base_city, form.cities_served, geoCountry, form.state],
  );

  const isDriver = form.category === "driver" || form.subtype === "driver";
  const isVehicle = form.category === "vehicle" || form.resource_class === "vehicle";
  const isTransport =
    ["driver", "vehicle", "taxi", "transfer"].includes(form.category) ||
    form.resource_class === "vehicle" ||
    isDriver;
  const subtypes = RESOURCE_SUBTYPES[form.resource_class] ?? [];
  const availabilities = availabilityOptionsFor(form.category);

  const hasCity = Boolean(form.base_city.trim()) || form.cities_served.length > 0;
  const locationSummary =
    [form.base_city, form.state, form.country].filter(Boolean).join(" · ") || "Sin definir";

  function submit() {
    const problem = validateResource(form);
    if (problem) {
      toast.error(problem);
      return;
    }
    onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>
            Completá los bloques que apliquen. Sólo el nombre es obligatorio; el resto se puede
            cargar en cualquier momento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ford Transit 2022 · Chofer Juan Pérez · Hotel Los Andes"
            />
          </div>

          <Accordion type="multiple" defaultValue={["general", "location"]} className="space-y-3">
            {/* ------------------------------------------------ información general */}
            <Block
              value="general"
              title="Información general"
              summary="Clasificación, empresa, proveedor y contacto"
            >
              <Field label="Clasificación">
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
              </Field>

              <Field label="Subtipo">
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
              </Field>

              <Field label="Categoría">
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
              </Field>

              <Field label="Origen">
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
              </Field>

              <Field label="Empresa">
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
              </Field>

              <Field label="Proveedor">
                <Select
                  value={form.provider_id || NONE}
                  onValueChange={(v) => set("provider_id", v === NONE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin proveedor</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.trade_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Agente vinculado">
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
              </Field>

              <Field label="Propietario">
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
              </Field>

              <Field label="Empresa propietaria">
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
              </Field>

              <Field label="Titular (particular u otro)">
                <Input
                  value={form.owner_name}
                  onChange={(e) => set("owner_name", e.target.value)}
                  placeholder="Nombre del titular"
                />
              </Field>

              {isDriver && (
                <>
                  <Field label="Nombre del conductor">
                    <Input
                      value={form.driver_first_name}
                      onChange={(e) => set("driver_first_name", e.target.value)}
                    />
                  </Field>
                  <Field label="Apellido del conductor">
                    <Input
                      value={form.driver_last_name}
                      onChange={(e) => set("driver_last_name", e.target.value)}
                    />
                  </Field>
                </>
              )}

              <Field label="Contacto">
                <Input
                  value={form.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                  placeholder="+54 9 294 ..."
                />
              </Field>
              <Field label="Email" wide>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Descripción" wide>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </Block>

            {/* -------------------------------------------------------- ubicación */}
            <Block value="location" title="Ubicación" summary={locationSummary}>
              <Field label="País">
                <Select
                  value={geoCountry}
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
              </Field>

              <Field label={regionLabelOf(geoCountry)}>
                {geoRegions.length > 0 ? (
                  <Select
                    value={form.state || NONE_GEO}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        state: v === NONE_GEO ? "" : v,
                        base_city: "",
                        cities_served: [],
                        tourist_zones: [],
                      }))
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
              </Field>

              <Field
                label="Ciudad base"
                hint={!form.state ? "Elegí primero la provincia / región." : undefined}
              >
                {regionCities.length > 0 ? (
                  <Select
                    value={form.base_city || NONE_GEO}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        base_city: v === NONE_GEO ? "" : v,
                        tourist_zones: [],
                      }))
                    }
                    disabled={!form.state}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin definir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_GEO}>Sin definir</SelectItem>
                      {regionCities.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.base_city}
                    onChange={(e) => set("base_city", e.target.value)}
                    disabled={!form.state}
                    placeholder="Ciudad base"
                  />
                )}
              </Field>

              <Field label="Zona operativa">
                <Input
                  value={form.operating_zone}
                  onChange={(e) => set("operating_zone", e.target.value)}
                  placeholder="Centro, Aeropuerto, Cerro..."
                />
              </Field>

              <Field
                label="Ciudades donde opera"
                wide
                hint="Buscá y sumá las ciudades; se muestran como etiquetas."
              >
                {countryCities.length > 0 ? (
                  <MultiSelect
                    options={countryCities}
                    value={form.cities_served}
                    onChange={(next) => setForm((f) => ({ ...f, cities_served: next }))}
                    placeholder="Sin ciudades seleccionadas"
                    searchPlaceholder="Buscar ciudad..."
                    disabled={!form.state}
                    disabledHint="Elegí primero la provincia / región."
                  />
                ) : (
                  <Input
                    value={form.cities_served.join(", ")}
                    onChange={(e) => set("cities_served", parseList(e.target.value))}
                    placeholder="Separá cada ciudad con una coma"
                  />
                )}
              </Field>

              <Field
                label="Zonas turísticas"
                wide
                hint="Se filtran automáticamente según las ciudades seleccionadas."
              >
                {zoneOptions.length > 0 ? (
                  <MultiSelect
                    options={zoneOptions}
                    value={form.tourist_zones}
                    onChange={(next) => setForm((f) => ({ ...f, tourist_zones: next }))}
                    placeholder="Sin zonas seleccionadas"
                    searchPlaceholder="Buscar zona turística..."
                    disabled={!hasCity}
                    disabledHint="Elegí primero una ciudad."
                  />
                ) : (
                  <Input
                    value={form.tourist_zones.join(", ")}
                    onChange={(e) => set("tourist_zones", parseList(e.target.value))}
                    disabled={!hasCity}
                    placeholder="Separá cada zona con una coma"
                  />
                )}
              </Field>

              <Field label="Dirección completa" wide>
                <Input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Av. Bustillo 1200"
                />
              </Field>
              <Field label="Código postal">
                <Input
                  value={form.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                />
              </Field>
              <Field label="Radio geográfico (km)">
                <Input
                  type="number"
                  min={0}
                  value={form.geo_radius_km}
                  onChange={(e) => set("geo_radius_km", e.target.value)}
                />
              </Field>
              <Field label="Latitud" hint="Sólo se almacena (mapas a futuro).">
                <Input
                  value={form.latitude}
                  onChange={(e) => set("latitude", e.target.value)}
                  placeholder="-41.1335"
                />
              </Field>
              <Field label="Longitud" hint="Sólo se almacena (mapas a futuro).">
                <Input
                  value={form.longitude}
                  onChange={(e) => set("longitude", e.target.value)}
                  placeholder="-71.3103"
                />
              </Field>
              <Field label="Punto de encuentro habitual" wide>
                <Input
                  value={form.meeting_point}
                  onChange={(e) => set("meeting_point", e.target.value)}
                />
              </Field>
              <Field label="Lugar de entrega">
                <Input
                  value={form.pickup_location}
                  onChange={(e) => set("pickup_location", e.target.value)}
                />
              </Field>
              <Field label="Lugar de devolución">
                <Input
                  value={form.dropoff_location}
                  onChange={(e) => set("dropoff_location", e.target.value)}
                />
              </Field>
            </Block>

            {/* --------------------------------------------------------- vehículo */}
            {isVehicle && (
              <Block
                value="vehicle"
                title="Vehículo"
                summary={
                  [form.vehicle_brand, form.vehicle_model, form.vehicle_year]
                    .filter(Boolean)
                    .join(" ") || "Marca, modelo y equipamiento"
                }
              >
                <Field label="Marca">
                  <Input
                    value={form.vehicle_brand}
                    onChange={(e) => set("vehicle_brand", e.target.value)}
                  />
                </Field>
                <Field label="Modelo">
                  <Input
                    value={form.vehicle_model}
                    onChange={(e) => set("vehicle_model", e.target.value)}
                  />
                </Field>
                <Field label="Versión">
                  <Input
                    value={form.vehicle_version}
                    onChange={(e) => set("vehicle_version", e.target.value)}
                    placeholder="XEI 1.8 CVT"
                  />
                </Field>
                <Field label="Año">
                  <Input
                    type="number"
                    min={1950}
                    value={form.vehicle_year}
                    onChange={(e) => set("vehicle_year", e.target.value)}
                  />
                </Field>
                <Field label="Patente">
                  <Input
                    value={form.vehicle_plate}
                    onChange={(e) => set("vehicle_plate", e.target.value)}
                  />
                </Field>
                <Field label="Color">
                  <Input
                    value={form.vehicle_color}
                    onChange={(e) => set("vehicle_color", e.target.value)}
                  />
                </Field>
                <Field label="Combustible">
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
                </Field>
                <Field label="Transmisión">
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
                </Field>
                <Field label="Tipo de vehículo">
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
                </Field>
                <div className="flex flex-wrap gap-4 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.is_accessible}
                      onCheckedChange={(v) => set("is_accessible", v === true)}
                    />
                    Accesibilidad
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.has_air_conditioning}
                      onCheckedChange={(v) => set("has_air_conditioning", v === true)}
                    />
                    Aire acondicionado
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.self_drive}
                      onCheckedChange={(v) => set("self_drive", v === true)}
                    />
                    Sin conductor (rent a car)
                  </label>
                </div>
                <Field label="Observaciones del vehículo" wide>
                  <Textarea
                    rows={2}
                    value={form.vehicle_notes}
                    onChange={(e) => set("vehicle_notes", e.target.value)}
                  />
                </Field>
              </Block>
            )}

            {/* -------------------------------------------------------- capacidad */}
            <Block value="capacity" title="Capacidad" summary="Pasajeros, unidades y equipaje">
              <Field label="Capacidad de pasajeros">
                <Input
                  type="number"
                  min={0}
                  value={form.pax_capacity}
                  onChange={(e) => set("pax_capacity", e.target.value)}
                />
              </Field>
              <Field label="Unidades disponibles">
                <Input
                  type="number"
                  min={0}
                  value={form.unit_count}
                  onChange={(e) => set("unit_count", e.target.value)}
                />
              </Field>
              <Field label="Límite operativo diario">
                <Input
                  type="number"
                  min={0}
                  value={form.operating_limit}
                  onChange={(e) => set("operating_limit", e.target.value)}
                />
              </Field>
              <Field label="Equipaje total">
                <Input
                  type="number"
                  min={0}
                  value={form.luggage_capacity}
                  onChange={(e) => set("luggage_capacity", e.target.value)}
                />
              </Field>
              <Field label="Equipaje grande">
                <Input
                  type="number"
                  min={0}
                  value={form.large_luggage_capacity}
                  onChange={(e) => set("large_luggage_capacity", e.target.value)}
                />
              </Field>
              <Field label="Equipaje de mano">
                <Input
                  type="number"
                  min={0}
                  value={form.cabin_luggage_capacity}
                  onChange={(e) => set("cabin_luggage_capacity", e.target.value)}
                />
              </Field>
            </Block>

            {/* -------------------------------------------------------- cobertura */}
            <Block
              value="coverage"
              title="Cobertura"
              summary="Alcance, radio de operación y destinos"
            >
              <Field label="Alcance de cobertura">
                <Select
                  value={form.coverage_scope || NONE}
                  onValueChange={(v) =>
                    set("coverage_scope", v === NONE ? "" : (v as CoverageScope))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin definir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin definir</SelectItem>
                    {COVERAGE_SCOPES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Radio máximo de operación (km)">
                <Input
                  type="number"
                  min={0}
                  value={form.max_distance_km}
                  onChange={(e) => set("max_distance_km", e.target.value)}
                />
              </Field>
              <Field label="Zonas comerciales" wide>
                <MultiSelect
                  options={[...RESOURCE_ZONES]}
                  value={form.zones}
                  onChange={(next) => setForm((f) => ({ ...f, zones: next }))}
                  placeholder="Sin zonas seleccionadas"
                  searchPlaceholder="Buscar zona..."
                />
              </Field>
              <Field label="Destinos habilitados" wide hint="Separá cada destino con una coma.">
                <Input
                  value={form.destinations.join(", ")}
                  onChange={(e) => set("destinations", parseList(e.target.value))}
                  placeholder="Aeropuerto Chapelco, Cerro Catedral"
                />
              </Field>
              <Field label="Anticipación mínima (horas)">
                <Input
                  type="number"
                  min={0}
                  value={form.advance_notice_hours}
                  onChange={(e) => set("advance_notice_hours", e.target.value)}
                />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Checkbox
                  checked={form.requires_advance_booking}
                  onCheckedChange={(v) => set("requires_advance_booking", v === true)}
                />
                Necesita reserva previa
              </label>
              {isTransport && (
                <Field label="Servicios de transporte que presta" wide>
                  <div className="flex flex-wrap gap-3 rounded-lg border border-border/70 p-3">
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
                </Field>
              )}
            </Block>

            {/* ------------------------------------------------------- rent a car */}
            {isVehicle && form.self_drive && (
              <Block
                value="rental"
                title="Alquiler sin conductor"
                summary="Condiciones comerciales (estructura preparada)"
              >
                <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
                  <Checkbox
                    checked={form.rental_requires_driver}
                    onCheckedChange={(v) => set("rental_requires_driver", v === true)}
                  />
                  Requiere conductor de la empresa
                </label>
                <Field label="Edad mínima">
                  <Input
                    type="number"
                    min={0}
                    value={form.rental_min_age}
                    onChange={(e) => set("rental_min_age", e.target.value)}
                  />
                </Field>
                <Field label="Licencia requerida">
                  <Select
                    value={form.rental_license_required || NONE}
                    onValueChange={(v) => set("rental_license_required", v === NONE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin definir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin definir</SelectItem>
                      {RENTAL_LICENSES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Depósito de garantía">
                  <Input
                    type="number"
                    min={0}
                    value={form.rental_deposit_amount}
                    onChange={(e) => set("rental_deposit_amount", e.target.value)}
                  />
                </Field>
                <Field label="Moneda del depósito">
                  <Select
                    value={form.rental_deposit_currency || "ARS"}
                    onValueChange={(v) => set("rental_deposit_currency", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Kilometraje incluido">
                  <Input
                    type="number"
                    min={0}
                    value={form.rental_included_km}
                    onChange={(e) => set("rental_included_km", e.target.value)}
                  />
                </Field>
                <Field label="Costo por km excedente">
                  <Input
                    type="number"
                    min={0}
                    value={form.rental_extra_km_cost}
                    onChange={(e) => set("rental_extra_km_cost", e.target.value)}
                  />
                </Field>
                <Field label="Política de combustible">
                  <Select
                    value={form.rental_fuel_policy || NONE}
                    onValueChange={(v) => set("rental_fuel_policy", v === NONE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin definir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin definir</SelectItem>
                      {RENTAL_FUEL_POLICIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Estado del vehículo">
                  <Select
                    value={form.rental_vehicle_condition || NONE}
                    onValueChange={(v) => set("rental_vehicle_condition", v === NONE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin definir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin definir</SelectItem>
                      {RENTAL_VEHICLE_CONDITIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Estos datos se almacenan para la futura operatoria de rent a car; todavía no
                  intervienen en cálculos ni en la asignación de servicios.
                </p>
              </Block>
            )}

            {/* ---------------------------------------------------- disponibilidad */}
            <Block
              value="availability"
              title="Disponibilidad"
              summary="Estado operativo y especialidades"
            >
              <Field label="Disponibilidad">
                <Select
                  value={form.availability}
                  onValueChange={(v) => set("availability", v as ResourceAvailability)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availabilities.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estado del registro">
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
              </Field>
              <Field label="Zona principal">
                <Input
                  value={form.main_zone}
                  onChange={(e) => set("main_zone", e.target.value)}
                  placeholder="Bariloche"
                />
              </Field>
              <Field label="Especialidades" wide>
                <MultiSelect
                  options={[...RESOURCE_SPECIALTIES]}
                  value={form.specialties}
                  onChange={(next) => setForm((f) => ({ ...f, specialties: next }))}
                  placeholder="Sin especialidades"
                  searchPlaceholder="Buscar especialidad..."
                />
              </Field>
            </Block>

            {/* ------------------------------------------------------ observaciones */}
            <Block value="notes" title="Observaciones" summary="Notas internas del recurso">
              <Field label="Observaciones internas" wide>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Los extras (sillas, portaesquí, GPS, cadenas...) se asocian desde la ficha del
                recurso, una vez guardado.
              </p>
            </Block>
          </Accordion>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting || form.name.trim().length === 0}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
