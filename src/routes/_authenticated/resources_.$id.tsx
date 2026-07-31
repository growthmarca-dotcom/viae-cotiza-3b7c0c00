import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Archive, Boxes, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ResourceFormDialog } from "@/components/resource-form-dialog";
import { agentFullName, listAssignableAgents, type Agent } from "@/lib/agents";
import {
  coverageOf,
  driverFullName,
  isDriverResource,
  isTransportResource,
  isVehicleResource,
  listAvailabilityLog,
  markResourceAvailable,
  serviceTypeLabel,
  vehicleTypeLabel,
  type ResourceAvailabilityEvent,
} from "@/lib/transport";
import { formatMoney } from "@/lib/currency";
import { bookingStatusLabel, type Booking } from "@/lib/bookings";
import {
  availabilityClasses,
  availabilityLabel,
  categoryLabel,
  companyKindLabel,
  getResource,
  listCompanies,
  listResourceBookings,
  recordStatusLabel,
  RESOURCE_AVAILABILITIES,
  resourceToInput,
  setResourceAvailability,
  setResourceStatus,
  updateResource,
  type Company,
  type Resource,
  type ResourceAvailability,
  type ResourceInput,
} from "@/lib/resources";

export const Route = createFileRoute("/_authenticated/resources_/$id")({
  component: ResourceDetailPage,
  head: () => ({
    meta: [
      { title: "Ficha de recurso — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Detalle operativo del recurso: capacidad, zonas, especialidades, disponibilidad y reservas asignadas.",
      },
      { property: "og:title", content: "Ficha de recurso — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Capacidad, cobertura y uso del recurso dentro de las reservas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResourceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [resource, setResource] = useState<Resource | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [bookings, setBookings] = useState<(Booking & { assignmentNotes: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [availabilityLog, setAvailabilityLog] = useState<ResourceAvailabilityEvent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getResource(id);
      setResource(r);
      if (!r) return;

      const [comps, ags, links] = await Promise.all([
        listCompanies(true),
        listAssignableAgents(),
        listResourceBookings(id),
      ]);
      setCompanies(comps);
      setAgents(ags);
      setCompany(comps.find((c) => c.id === r.company_id) ?? null);

      if (links.length > 0) {
        const { data } = await supabase
          .from("bookings")
          .select("*")
          .in(
            "id",
            links.map((l) => l.booking_id),
          );
        const notes = new Map(links.map((l) => [l.booking_id, l.notes]));
        setBookings(
          ((data ?? []) as Booking[]).map((b) => ({
            ...b,
            assignmentNotes: notes.get(b.id) ?? null,
          })),
        );
      } else setBookings([]);

      setAvailabilityLog(await listAvailabilityLog(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el recurso");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(input: ResourceInput) {
    setSaving(true);
    try {
      await updateResource(id, input);
      toast.success("Recurso actualizado");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando recurso...
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">No encontramos este recurso.</p>
        <Link to="/resources" className="mt-4 inline-block text-sm font-medium text-primary">
          Volver a Recursos
        </Link>
      </div>
    );
  }

  const agentName = agents.find((a) => a.id === resource.agent_id);

  return (
    <div className="space-y-6 pb-20">
      <button
        onClick={() => navigate({ to: "/resources" })}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Recursos
      </button>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
              <Boxes className="h-3.5 w-3.5 text-gold" /> {categoryLabel(resource.category)}
            </span>
            <h1 className="mt-3 font-display text-3xl font-semibold">{resource.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {companyKindLabel(resource.kind)}
              {company ? ` · ${company.name}` : ""}
              {resource.main_zone ? ` · ${resource.main_zone}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${availabilityClasses(resource.availability)}`}
            >
              {availabilityLabel(resource.availability)}
            </span>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <Info label="Capacidad">
            {resource.pax_capacity != null ? `${resource.pax_capacity} pax` : "—"}
          </Info>
          <Info label="Unidades / habitaciones">{resource.unit_count ?? "—"}</Info>
          <Info label="Límite operativo diario">{resource.operating_limit ?? "—"}</Info>
          <Info label="Agente vinculado">{agentName ? agentFullName(agentName) : "—"}</Info>
          <Info label="Contacto">
            {[resource.contact_name, resource.whatsapp, resource.email].filter(Boolean).join(" · ") ||
              "—"}
          </Info>
          <Info label="Registro">{recordStatusLabel(resource.record_status)}</Info>
          <Info label="Zonas de cobertura">
            {(resource.zones ?? []).length > 0 ? resource.zones.join(", ") : "—"}
          </Info>
          <Info label="Especialidades">
            {(resource.specialties ?? []).length > 0 ? resource.specialties.join(", ") : "—"}
          </Info>
          <Info label="Alta">{new Date(resource.created_at).toLocaleDateString()}</Info>
          {resource.description && (
            <div className="sm:col-span-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Descripción</p>
              <p className="whitespace-pre-line">{resource.description}</p>
            </div>
          )}
          {resource.notes && (
            <div className="sm:col-span-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Observaciones internas
              </p>
              <p className="whitespace-pre-line">{resource.notes}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Disponibilidad:</span>
          <Button
            size="sm"
            disabled={saving || resource.availability === "available"}
            onClick={async () => {
              setSaving(true);
              try {
                await markResourceAvailable(resource.id);
                toast.success("Estado actualizado: Disponible");
                await load();
              } finally {
                setSaving(false);
              }
            }}
          >
            ESTOY DISPONIBLE
          </Button>
          {RESOURCE_AVAILABILITIES.map((a) => (
            <Button
              key={a.value}
              size="sm"
              variant={a.value === resource.availability ? "default" : "outline"}
              disabled={saving || a.value === resource.availability}
              onClick={async () => {
                setSaving(true);
                try {
                  await setResourceAvailability(resource.id, a.value as ResourceAvailability);
                  toast.success(`Disponibilidad: ${a.label}`);
                  await load();
                } finally {
                  setSaving(false);
                }
              }}
            >
              {a.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={async () => {
              const archived = resource.record_status === "archived";
              await setResourceStatus(resource.id, archived ? "active" : "archived");
              toast.success(archived ? "Recurso restaurado" : "Recurso archivado");
              load();
            }}
          >
            <Archive className="mr-2 h-4 w-4" />
            {resource.record_status === "archived" ? "Restaurar" : "Archivar"}
          </Button>
        </div>
      </div>

      {isTransportResource(resource) && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-xl font-semibold">Red de transporte</h2>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <Info label="Ciudad base">{resource.base_city ?? "—"}</Info>
            <Info label="Provincia / País">
              {[resource.state, resource.country].filter(Boolean).join(", ") || "—"}
            </Info>
            <Info label="Distancia máxima">
              {resource.max_distance_km != null ? `${resource.max_distance_km} km` : "—"}
            </Info>
            <Info label="Ciudades donde opera">
              {(resource.cities_served ?? []).join(", ") || "—"}
            </Info>
            <Info label="Destinos habilitados">
              {(resource.destinations ?? []).join(", ") || "—"}
            </Info>
            <Info label="Reserva previa">
              {resource.requires_advance_booking
                ? `Sí${resource.advance_notice_hours ? ` · ${resource.advance_notice_hours} h` : ""}`
                : "No"}
            </Info>
            <Info label="Servicios que presta">
              {(resource.transport_service_types ?? []).map(serviceTypeLabel).join(", ") || "—"}
            </Info>
            <Info label="Cobertura total">{coverageOf(resource).join(", ") || "—"}</Info>
            {isDriverResource(resource) && (
              <Info label="Conductor">{driverFullName(resource)}</Info>
            )}
            {isVehicleResource(resource) && (
              <>
                <Info label="Vehículo">
                  {[resource.vehicle_brand, resource.vehicle_model, resource.vehicle_year]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </Info>
                <Info label="Patente / color">
                  {[resource.vehicle_plate, resource.vehicle_color].filter(Boolean).join(" · ") ||
                    "—"}
                </Info>
                <Info label="Tipo de vehículo">{vehicleTypeLabel(resource.vehicle_type)}</Info>
                <Info label="Equipaje">{resource.luggage_capacity ?? "—"}</Info>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Historial de disponibilidad</h2>
        {availabilityLog.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin cambios registrados.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {availabilityLog.map((e) => (
              <li key={e.id} className="border-l border-border pl-4 text-sm">
                <p className="font-medium">
                  {e.from_availability
                    ? `${availabilityLabel(e.from_availability)} → ${availabilityLabel(e.to_availability)}`
                    : availabilityLabel(e.to_availability)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Reservas asignadas</h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Este recurso todavía no fue asignado a ninguna reserva.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Reserva</th>
                  <th className="py-2 pr-4">Destino</th>
                  <th className="py-2 pr-4">Viaje</th>
                  <th className="py-2 pr-4">Importe</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t border-border/60">
                    <td className="py-2 pr-4 font-medium">
                      <Link to="/bookings/$id" params={{ id: b.id }} className="hover:text-primary">
                        {b.booking_number}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{b.destination ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {b.travel_start ?? "—"}
                      {b.travel_end ? ` → ${b.travel_end}` : ""}
                    </td>
                    <td className="py-2 pr-4">
                      {formatMoney(b.currency, Number(b.amount ?? 0))}
                    </td>
                    <td className="py-2">{bookingStatusLabel(b.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ResourceFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={resourceToInput(resource)}
        companies={companies}
        agents={agents}
        title="Editar recurso"
        submitLabel="Guardar cambios"
        submitting={saving}
        onSubmit={save}
      />
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}
