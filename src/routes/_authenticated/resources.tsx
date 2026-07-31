import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Building2, Loader2, Package, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyFormDialog } from "@/components/company-form-dialog";
import { ResourceFormDialog } from "@/components/resource-form-dialog";
import { ExtrasManager } from "@/components/extras-manager";
import { listAssignableAgents } from "@/lib/agents";
import {
  RESOURCE_CLASSES,
  RESOURCE_SUBTYPES,
  resourceClassLabel,
  subtypeLabel,
  type ResourceClass,
} from "@/lib/resource-catalog";
import { allCities, allRegions } from "@/lib/geo";
import {
  availabilityClasses,
  availabilityLabel,
  categoryLabel,
  companyKindLabel,
  computeResourceStats,
  createCompany,
  createResource,
  listCompanies,
  listResources,
  recordStatusLabel,
  RESOURCE_AVAILABILITIES,
  RESOURCE_CATEGORIES,
  RESOURCE_ZONES,
  type CompanyInput,
  type CompanyKind,
  type ResourceAvailability,
  type ResourceCategory,
  type ResourceInput,
} from "@/lib/resources";


export const Route = createFileRoute("/_authenticated/resources")({
  component: ResourcesPage,
  head: () => ({
    meta: [
      { title: "Recursos operativos — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Administrá empresas internas y externas junto a los recursos operativos: alojamientos, vehículos, guías, excursiones y seguros.",
      },
      { property: "og:title", content: "Recursos operativos — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Capacidad, zonas, especialidades y disponibilidad de cada recurso turístico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResourcesPage() {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<CompanyKind | "all">("all");
  const [category, setCategory] = useState<ResourceCategory | "all">("all");
  const [availability, setAvailability] = useState<ResourceAvailability | "all">("all");
  const [zone, setZone] = useState("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [resourceClass, setResourceClass] = useState<ResourceClass | "all">("all");
  const [subtype, setSubtype] = useState("all");
  const [state, setState] = useState("all");
  const [city, setCity] = useState("all");
  const [minCapacity, setMinCapacity] = useState("");
  const [selfDrive, setSelfDrive] = useState(false);

  const [resourceOpen, setResourceOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const resourcesQuery = useQuery({
    queryKey: [
      "resources",
      search,
      kind,
      category,
      availability,
      zone,
      includeArchived,
      resourceClass,
      subtype,
      state,
      city,
      minCapacity,
      selfDrive,
    ],
    queryFn: () =>
      listResources({
        search,
        kind,
        category,
        availability,
        zone,
        includeArchived,
        resourceClass,
        subtype,
        state,
        city,
        minCapacity,
        selfDrive,
      }),
  });


  const companiesQuery = useQuery({
    queryKey: ["companies", includeArchived],
    queryFn: () => listCompanies(includeArchived),
  });

  const agentsQuery = useQuery({ queryKey: ["assignable-agents"], queryFn: listAssignableAgents });

  const resources = useMemo(() => resourcesQuery.data ?? [], [resourcesQuery.data]);
  const companies = useMemo(() => companiesQuery.data ?? [], [companiesQuery.data]);
  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const stats = computeResourceStats(resources);
  const subtypeOptions =
    resourceClass === "all"
      ? Object.values(RESOURCE_SUBTYPES).flat()
      : (RESOURCE_SUBTYPES[resourceClass] ?? []);


  async function submitResource(input: ResourceInput) {
    setSaving(true);
    try {
      await createResource(input);
      toast.success("Recurso creado");
      setResourceOpen(false);
      resourcesQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el recurso");
    } finally {
      setSaving(false);
    }
  }

  async function submitCompany(input: CompanyInput) {
    setSaving(true);
    try {
      await createCompany(input);
      toast.success("Empresa creada");
      setCompanyOpen(false);
      companiesQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la empresa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Boxes className="h-3.5 w-3.5 text-gold" /> Operación
          </span>
          <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            Recursos operativos
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Todo lo que puede asignarse a una reserva: alojamientos, vehículos, choferes, guías,
            excursiones, seguros y agentes, sean propios o de empresas asociadas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCompanyOpen(true)}>
            <Building2 className="mr-2 h-4 w-4" /> Nueva empresa
          </Button>
          <Button onClick={() => setResourceOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo recurso
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recursos" value={String(stats.total)} />
        <Stat label="Disponibles" value={String(stats.available)} />
        <Stat label="Vehículos disponibles" value={String(stats.vehiclesAvailable)} />
        <Stat label="Choferes disponibles" value={String(stats.driversAvailable)} />
      </section>

      <Tabs defaultValue="resources">
        <TabsList>
          <TabsTrigger value="resources">
            <Boxes className="mr-2 h-4 w-4" /> Recursos
          </TabsTrigger>
          <TabsTrigger value="companies">
            <Building2 className="mr-2 h-4 w-4" /> Empresas
          </TabsTrigger>
          <TabsTrigger value="extras">
            <Package className="mr-2 h-4 w-4" /> Extras
          </TabsTrigger>
        </TabsList>


        <TabsContent value="resources" className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, zona o especialidad..."
                  className="pl-9"
                />
              </div>
              <Filter value={kind} onChange={(v) => setKind(v as CompanyKind | "all")}>
                <option value="all">Internos y externos</option>
                <option value="internal">Internos</option>
                <option value="external">Externos</option>
              </Filter>
              <Filter
                value={category}
                onChange={(v) => setCategory(v as ResourceCategory | "all")}
              >
                <option value="all">Todas las categorías</option>
                {RESOURCE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Filter>
              <Filter
                value={availability}
                onChange={(v) => setAvailability(v as ResourceAvailability | "all")}
              >
                <option value="all">Toda disponibilidad</option>
                {RESOURCE_AVAILABILITIES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Filter>
              <Filter value={zone} onChange={setZone}>
                <option value="all">Todas las zonas</option>
                {RESOURCE_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Filter>
              <Filter
                value={resourceClass}
                onChange={(v) => {
                  setResourceClass(v as ResourceClass | "all");
                  setSubtype("all");
                }}
              >
                <option value="all">Toda clasificación</option>
                {RESOURCE_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Filter>
              <Filter value={subtype} onChange={setSubtype}>
                <option value="all">Todos los subtipos</option>
                {subtypeOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Filter>
              <Filter value={state} onChange={setState}>
                <option value="all">Toda provincia</option>
                {allRegions().map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Filter>
              <Filter value={city} onChange={setCity}>
                <option value="all">Toda ciudad</option>
                {allCities().map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Filter>
              <Input
                type="number"
                min={0}
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
                placeholder="Pax mín."
                className="h-10 w-28"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selfDrive}
                  onChange={(e) => setSelfDrive(e.target.checked)}
                />
                Rent a car
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                />
                Ver archivados
              </label>

            </div>
          </section>

          {resourcesQuery.isLoading ? (
            <Loading label="Cargando recursos..." />
          ) : resources.length === 0 ? (
            <Empty
              title="Todavía no hay recursos"
              text="Cargá alojamientos, vehículos, guías o servicios para poder asignarlos a las reservas."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Recurso</th>
                    <th className="px-4 py-3">Clasificación</th>
                    <th className="px-4 py-3">Origen</th>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Zona</th>
                    <th className="px-4 py-3">Capacidad</th>
                    <th className="px-4 py-3">Disponibilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/40">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to="/resources/$id"
                          params={{ id: r.id }}
                          className="hover:text-primary"
                        >
                          {r.name}
                        </Link>
                        {r.record_status !== "active" && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({recordStatusLabel(r.record_status)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {resourceClassLabel(r.resource_class)}
                        <span className="block text-xs text-muted-foreground">
                          {r.subtype
                            ? subtypeLabel(r.resource_class, r.subtype)
                            : categoryLabel(r.category)}
                        </span>
                      </td>

                      <td className="px-4 py-3">{companyKindLabel(r.kind)}</td>
                      <td className="px-4 py-3">
                        {r.company_id ? (companyName.get(r.company_id) ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.main_zone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.pax_capacity != null ? `${r.pax_capacity} pax` : "—"}
                        {r.unit_count != null ? ` · ${r.unit_count} u.` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${availabilityClasses(r.availability)}`}
                        >
                          {availabilityLabel(r.availability)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {stats.byCategory.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-display text-xl font-semibold">Recursos por categoría</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {stats.byCategory.map((c) => (
                  <span
                    key={c.category}
                    className="rounded-full border border-border px-3 py-1 text-xs"
                  >
                    {c.label}: <strong>{c.count}</strong>
                  </span>
                ))}
              </div>
            </section>
          )}

          {stats.byState.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-display text-xl font-semibold">Distribución geográfica</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {stats.byState.map((s) => (
                  <span
                    key={s.state}
                    className="rounded-full border border-border px-3 py-1 text-xs"
                  >
                    {s.state}: <strong>{s.count}</strong>
                  </span>
                ))}
              </div>
            </section>
          )}
        </TabsContent>


        <TabsContent value="companies" className="space-y-6">
          {companiesQuery.isLoading ? (
            <Loading label="Cargando empresas..." />
          ) : companies.length === 0 ? (
            <Empty
              title="Todavía no hay empresas"
              text="Registrá tu empresa interna y las empresas proveedoras con las que trabajás."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs">
                      {companyKindLabel(c.kind)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[c.city, c.state, c.country].filter(Boolean).join(", ") || "Sin ubicación"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.contact_name ?? "Sin contacto"}
                    {c.whatsapp ? ` · ${c.whatsapp}` : ""}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {resources.filter((r) => r.company_id === c.id).length} recurso(s) ·{" "}
                    {recordStatusLabel(c.record_status)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="extras" className="space-y-6">
          <ExtrasManager includeArchived={includeArchived} />
        </TabsContent>
      </Tabs>


      <ResourceFormDialog
        open={resourceOpen}
        onOpenChange={setResourceOpen}
        companies={companies}
        agents={agentsQuery.data ?? []}
        title="Nuevo recurso"
        submitLabel="Crear recurso"
        submitting={saving}
        onSubmit={submitResource}
      />
      <CompanyFormDialog
        open={companyOpen}
        onOpenChange={setCompanyOpen}
        title="Nueva empresa"
        submitLabel="Crear empresa"
        submitting={saving}
        onSubmit={submitCompany}
      />
    </div>
  );
}

function Filter({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
    >
      {children}
    </select>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <span className="text-sm text-muted-foreground">{label}</span>
      <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <Boxes className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
