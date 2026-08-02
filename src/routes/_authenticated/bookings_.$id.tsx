import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Archive,
  Boxes,
  Building2,
  Calculator,
  CheckSquare,
  Coins,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Route as RouteIcon,
  Save,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookingTransportTab } from "@/components/booking-transport-panel";
import { BookingServicesPanel } from "@/components/booking-services-panel";
import { CommissionSimulationPanel } from "@/components/commission-simulation-panel";
import { BookingTrackingCard } from "@/components/booking-tracking-card";
import { BookingChecklistPanel } from "@/components/booking-checklist-panel";
import { BookingIncidentsPanel } from "@/components/booking-incidents-panel";
import { BookingPassengersPanel } from "@/components/booking-passengers-panel";
import { BookingDossierHeader } from "@/components/booking-dossier-header";
import { BookingTimelinePanel } from "@/components/booking-timeline-panel";
import { BookingEconomyPanel } from "@/components/booking-economy-panel";
import { BookingCommunicationsPanel } from "@/components/booking-communications-panel";
import { getTripState, type TripStateResult } from "@/lib/trip-state";

import { useAccount } from "@/hooks/use-account";
import {
  listInternalUsers,
  OPERATION_STATUSES,
  operationStatusClasses,
  operationStatusLabel,
  setOperationsNotes,
  setOperationsOwner,
  setOperationStatus,
  type InternalUser,
  type OperationStatus,
} from "@/lib/operations";
import { formatMoney } from "@/lib/currency";
import { stageLabel } from "@/lib/opportunities";
import {
  BOOKING_DOCUMENT_KINDS,
  BOOKING_STATUSES,
  bookingStatusLabel,
  documentKindLabel,
  getBooking,
  listBookingDocuments,
  listBookingPayments,
  listStatusHistory,
  setBookingProvider,
  setBookingStatus,
  archiveBooking,
  type Booking,
  type BookingDocument,
  type BookingPayment,
  type BookingStatus,
  type BookingStatusEvent,
} from "@/lib/bookings";
import {
  assignResourceToBooking,
  availabilityLabel,
  categoryLabel,
  listBookingResources,
  listResources,
  unassignResource,
  type BookingResource,
  type Resource,
} from "@/lib/resources";

export const Route = createFileRoute("/_authenticated/bookings_/$id")({
  component: BookingDetailPage,
  head: () => ({
    meta: [
      { title: "Expediente de viaje — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Expediente 360° del viaje: estado comercial y operativo, pasajeros, servicios, economía, documentos, comunicaciones y timeline.",
      },
      { property: "og:title", content: "Expediente de viaje — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Centro operativo del viaje: servicios, economía, documentos y cronología.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});


type ClientRow = { id: string; full_name: string; last_name: string | null; email: string | null };
type OpportunityRow = { id: string; title: string; stage: string };
type QuotationRow = { id: string; title: string; status: string };

function BookingDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityRow | null>(null);
  const [quotation, setQuotation] = useState<QuotationRow | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [history, setHistory] = useState<BookingStatusEvent[]>([]);
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [tripState, setTripState] = useState<TripStateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await getBooking(id);
      setBooking(b);
      if (!b) return;

      const [{ data: c }, hist, docs, pays] = await Promise.all([
        supabase
          .from("clients")
          .select("id, full_name, last_name, email")
          .eq("id", b.client_id)
          .maybeSingle(),
        listStatusHistory(id),
        listBookingDocuments(id),
        listBookingPayments(id),
      ]);
      setClient((c as ClientRow) ?? null);
      setHistory(hist);
      setDocuments(docs);
      setPayments(pays);

      if (b.opportunity_id) {
        const { data } = await supabase
          .from("opportunities")
          .select("id, title, stage")
          .eq("id", b.opportunity_id)
          .maybeSingle();
        setOpportunity((data as OpportunityRow) ?? null);
      } else setOpportunity(null);

      if (b.quotation_id) {
        const { data } = await supabase
          .from("quotations")
          .select("id, title, status")
          .eq("id", b.quotation_id)
          .maybeSingle();
        setQuotation((data as QuotationRow) ?? null);
      } else setQuotation(null);

      if (b.assigned_agent_id) {
        const { data } = await supabase
          .from("agents")
          .select("first_name, last_name")
          .eq("id", b.assigned_agent_id)
          .maybeSingle();
        setAgentName(
          data ? [data.first_name, data.last_name].filter(Boolean).join(" ") : null,
        );
      } else setAgentName(null);

      if (b.organization_id) {
        const { data } = await supabase
          .from("organizations")
          .select("legal_name, trade_name")
          .eq("id", b.organization_id)
          .maybeSingle();
        setOrganizationName(
          data ? (data.trade_name?.trim() || data.legal_name?.trim() || null) : null,
        );
      } else setOrganizationName(null);

      // Estado operativo derivado (v1.9.5.3): solo lectura, no persiste nada.
      try {
        setTripState(await getTripState(id));
      } catch {
        setTripState(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la reserva");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(status: BookingStatus) {
    if (!booking) return;
    setSaving(true);
    try {
      await setBookingStatus(booking.id, status);
      toast.success(`Estado actualizado a "${bookingStatusLabel(status)}"`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando reserva...
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">No encontramos esta reserva.</p>
        <Link to="/bookings" className="mt-4 inline-block text-sm font-medium text-primary">
          Volver a Reservas
        </Link>
      </div>
    );
  }

  const clientName = client
    ? [client.full_name, client.last_name].filter(Boolean).join(" ")
    : "Cliente";

  return (
    <div className="space-y-6 pb-20">
      <button
        onClick={() => navigate({ to: "/bookings" })}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Reservas
      </button>

      <BookingDossierHeader
        booking={booking}
        clientName={clientName}
        agentName={agentName}
        organizationName={organizationName}
        tripState={tripState}
      />

      <Tabs defaultValue="summary">
        <TabsList className="flex-wrap">
          <TabsTrigger value="summary">
            <LayoutDashboard className="mr-2 h-4 w-4" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="operation">
            <Wrench className="mr-2 h-4 w-4" /> Servicios y operación
          </TabsTrigger>
          <TabsTrigger value="economy">
            <Coins className="mr-2 h-4 w-4" /> Economía
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="communications">
            <MessageSquare className="mr-2 h-4 w-4" /> Comunicaciones
          </TabsTrigger>
          <TabsTrigger value="commissions">
            <Calculator className="mr-2 h-4 w-4" /> Comisiones
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <History className="mr-2 h-4 w-4" /> Timeline
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------ Resumen */}
        <TabsContent value="summary" className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold">Datos del viaje</h2>
            <div className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
              <Info label="Cliente">
                {client ? (
                  <Link
                    to="/clients/$id"
                    params={{ id: client.id }}
                    className="text-primary hover:underline"
                  >
                    {clientName}
                  </Link>
                ) : (
                  "—"
                )}
              </Info>
              <Info label="Destino">{booking.destination ?? "—"}</Info>
              <Info label="Fechas de viaje">
                {booking.travel_start ?? "—"}
                {booking.travel_end ? ` → ${booking.travel_end}` : ""}
              </Info>
              <Info label="Oportunidad">
                {opportunity ? `${opportunity.title} · ${stageLabel(opportunity.stage)}` : "—"}
              </Info>
              <Info label="Cotización origen">
                {quotation ? (
                  <Link
                    to="/quotations/$id"
                    params={{ id: quotation.id }}
                    className="text-primary hover:underline"
                  >
                    {quotation.title}
                  </Link>
                ) : (
                  "—"
                )}
              </Info>
              <Info label="Importe">
                {formatMoney(booking.currency, Number(booking.amount ?? 0))}
                {booking.exchange_rate != null ? ` · TC ${booking.exchange_rate}` : ""}
              </Info>
              <Info label="Agente responsable">{agentName ?? "Sin asignar"}</Info>
              <Info label="Organización">{organizationName ?? "—"}</Info>
              <Info label="Registro">
                {booking.record_status === "archived" ? "Archivada" : "Activa"}
              </Info>
              {booking.notes && (
                <div className="sm:col-span-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Observaciones
                  </p>
                  <p className="whitespace-pre-line">{booking.notes}</p>
                </div>
              )}
            </div>

            <BookingTrackingCard
              bookingId={booking.id}
              status={booking.client_status}
              token={booking.tracking_token}
              enabled={booking.tracking_enabled}
              onChanged={load}
            />

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Estado comercial:</span>
              {BOOKING_STATUSES.map((s) => (
                <Button
                  key={s.value}
                  size="sm"
                  variant={s.value === booking.status ? "default" : "outline"}
                  disabled={saving || s.value === booking.status}
                  onClick={() => changeStatus(s.value)}
                >
                  {s.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={async () => {
                  await archiveBooking(booking.id, booking.record_status !== "archived");
                  toast.success(
                    booking.record_status === "archived"
                      ? "Reserva restaurada"
                      : "Reserva archivada",
                  );
                  load();
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                {booking.record_status === "archived" ? "Restaurar" : "Archivar"}
              </Button>
            </div>
          </div>

          <BookingPassengersPanel bookingId={booking.id} />

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold">Historial de estados comerciales</h2>
            <ol className="mt-6 space-y-4">
              {history.length === 0 && (
                <li className="text-sm text-muted-foreground">Sin movimientos registrados.</li>
              )}
              {history.map((h) => (
                <li key={h.id} className="relative border-l border-border pl-6">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold" />
                  <p className="text-sm font-medium">
                    {h.from_status
                      ? `${bookingStatusLabel(h.from_status)} → ${bookingStatusLabel(h.to_status)}`
                      : bookingStatusLabel(h.to_status)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()}
                    {h.comment ? ` · ${h.comment}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>

        {/* -------------------------------------------- Servicios y operación */}
        <TabsContent value="operation" className="space-y-6">
          <OperationCard booking={booking} onChanged={load} />
          <BookingServicesPanel bookingId={booking.id} />

          <Tabs defaultValue="resources">
            <TabsList className="flex-wrap">
              <TabsTrigger value="resources">
                <Boxes className="mr-2 h-4 w-4" /> Recursos
              </TabsTrigger>
              <TabsTrigger value="transport">
                <RouteIcon className="mr-2 h-4 w-4" /> Transporte
              </TabsTrigger>
              <TabsTrigger value="checklist">
                <CheckSquare className="mr-2 h-4 w-4" /> Checklist
              </TabsTrigger>
              <TabsTrigger value="incidents">
                <AlertCircle className="mr-2 h-4 w-4" /> Incidencias
              </TabsTrigger>
              <TabsTrigger value="provider">
                <Building2 className="mr-2 h-4 w-4" /> Proveedor
              </TabsTrigger>
            </TabsList>
            <TabsContent value="resources">
              <ResourcesTab bookingId={booking.id} />
            </TabsContent>
            <TabsContent value="transport">
              <BookingTransportTab bookingId={booking.id} />
            </TabsContent>
            <TabsContent value="checklist">
              <BookingChecklistPanel bookingId={booking.id} />
            </TabsContent>
            <TabsContent value="incidents">
              <BookingIncidentsPanel bookingId={booking.id} />
            </TabsContent>
            <TabsContent value="provider">
              <ProviderTab booking={booking} onSaved={load} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ----------------------------------------------------------- Economía */}
        <TabsContent value="economy">
          <BookingEconomyPanel booking={booking} payments={payments} />
        </TabsContent>

        {/* --------------------------------------------------------- Documentos */}
        <TabsContent value="documents">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold">Documentación</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Documentos asociados a la reserva: voucher, recibos, facturas y otros archivos.
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Documento</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4">Fecha de creación</th>
                    <th className="py-2 pr-4">Cargado por</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                        Sin documentos cargados.
                      </td>
                    </tr>
                  )}
                  {documents.map((d) => (
                    <tr key={d.id} className="border-t border-border/60">
                      <td className="py-2 pr-4 font-medium">{d.title}</td>
                      <td className="py-2 pr-4">{documentKindLabel(d.kind)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(d.created_at).toLocaleString("es-AR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {d.user_id ? "Usuario interno" : "—"}
                      </td>
                      <td className="py-2">{d.file_path ? "Archivo cargado" : "Sin archivo"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {BOOKING_DOCUMENT_KINDS.map((k) => {
                const items = documents.filter((d) => d.kind === k.value);
                return (
                  <div
                    key={k.value}
                    className="rounded-xl border border-dashed border-border p-4 text-sm"
                  >
                    <p className="font-medium">{k.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {items.length === 0 ? "Sin archivos" : `${items.length} archivo(s)`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ----------------------------------------------------- Comunicaciones */}
        <TabsContent value="communications">
          <BookingCommunicationsPanel bookingId={booking.id} />
        </TabsContent>

        {/* --------------------------------------------------------- Comisiones */}
        <TabsContent value="commissions" className="space-y-3">
          <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-sm">
            Simulación — no genera movimiento contable
          </p>
          <CommissionSimulationPanel bookingId={booking.id} />
        </TabsContent>

        {/* ----------------------------------------------------------- Timeline */}
        <TabsContent value="timeline">
          <BookingTimelinePanel bookingId={booking.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}


/** Relación con el futuro módulo de proveedores: por ahora, datos de referencia. */
function ProviderTab({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const [name, setName] = useState(booking.provider_name ?? "");
  const [reference, setReference] = useState(booking.provider_reference ?? "");
  const [notes, setNotes] = useState(booking.provider_notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await setBookingProvider(booking.id, {
        provider_name: name.trim() || null,
        provider_reference: reference.trim() || null,
        provider_notes: notes.trim() || null,
      });
      toast.success("Datos del proveedor guardados");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold">Proveedor</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Relación preparada para el futuro módulo de proveedores. Por ahora se registran los datos de
        referencia de la operación.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Proveedor</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Operador, hotel, mayorista..." />
        </div>
        <div className="space-y-2">
          <Label>Referencia / localizador</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Observaciones del proveedor</Label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

/** Recursos operativos asignados a la reserva (alojamientos, vehículos, guías...). */
function ResourcesTab({ bookingId }: { bookingId: string }) {
  const [links, setLinks] = useState<BookingResource[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selected, setSelected] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ls, rs] = await Promise.all([listBookingResources(bookingId), listResources()]);
      setLinks(ls);
      setResources(rs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los recursos");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const byId = new Map(resources.map((r) => [r.id, r]));
  const available = resources.filter((r) => !links.some((l) => l.resource_id === r.id));

  async function assign() {
    if (!selected) return;
    setSaving(true);
    try {
      await assignResourceToBooking(bookingId, selected, notes);
      toast.success("Recurso asignado a la reserva");
      setSelected("");
      setNotes("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo asignar el recurso");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold">Recursos asignados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Alojamientos, vehículos, guías, excursiones o servicios que forman parte de esta operación.
      </p>

      {loading ? (
        <div className="flex items-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando recursos...
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-2">
              <Label>Recurso</Label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Seleccioná un recurso...</option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {categoryLabel(r.category)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label>Nota de la asignación</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button onClick={assign} disabled={saving || !selected}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Asignar
            </Button>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Recurso</th>
                  <th className="py-2 pr-4">Categoría</th>
                  <th className="py-2 pr-4">Disponibilidad</th>
                  <th className="py-2 pr-4">Nota</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {links.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                      Sin recursos asignados todavía.
                    </td>
                  </tr>
                )}
                {links.map((l) => {
                  const r = byId.get(l.resource_id);
                  return (
                    <tr key={l.id} className="border-t border-border/60">
                      <td className="py-2 pr-4 font-medium">
                        {r ? (
                          <Link
                            to="/resources/$id"
                            params={{ id: r.id }}
                            className="hover:text-primary"
                          >
                            {r.name}
                          </Link>
                        ) : (
                          "Recurso"
                        )}
                      </td>
                      <td className="py-2 pr-4">{r ? categoryLabel(r.category) : "—"}</td>
                      <td className="py-2 pr-4">{r ? availabilityLabel(r.availability) : "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{l.notes ?? "—"}</td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await unassignResource(l.id);
                            toast.success("Recurso desasignado");
                            load();
                          }}
                        >
                          Quitar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Bloque operativo (v1.8): estado interno de operación, responsable de la
 * central y notas. El agente vendedor lo ve en modo lectura.
 */
function OperationCard({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const { isOperations } = useAccount();
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [notes, setNotes] = useState(booking.operations_notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOperations) return;
    listInternalUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [isOperations]);

  useEffect(() => {
    setNotes(booking.operations_notes ?? "");
  }, [booking.operations_notes]);

  const ownerName = booking.operations_owner_id
    ? (users.find((u) => u.id === booking.operations_owner_id)?.name ?? "Responsable interno")
    : "Sin responsable operativo";

  async function run(fn: () => Promise<void>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la operación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Operación</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado interno de ejecución, independiente del estado comercial de la venta.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${operationStatusClasses(booking.operation_status)}`}
        >
          {operationStatusLabel(booking.operation_status)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <Info label="Responsable operativo">{ownerName}</Info>
        <Info label="Tomada el">
          {booking.operations_taken_at
            ? new Date(booking.operations_taken_at).toLocaleString("es-AR", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "—"}
        </Info>
        <Info label="Última actualización operativa">
          {booking.operations_updated_at
            ? new Date(booking.operations_updated_at).toLocaleString("es-AR", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "—"}
        </Info>
      </div>

      {isOperations ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Estado operativo</Label>
              <Select
                value={booking.operation_status}
                onValueChange={(v) =>
                  run(
                    () => setOperationStatus(booking.id, v as OperationStatus),
                    "Estado operativo actualizado",
                  )
                }
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label>Responsable operativo</Label>
              <Select
                value={booking.operations_owner_id ?? "__none__"}
                onValueChange={(v) =>
                  run(
                    () => setOperationsOwner(booking.id, v === "__none__" ? null : v),
                    "Responsable operativo actualizado",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin responsable</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas internas de operación</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              run(
                () => setOperationsNotes(booking.id, notes.trim() || null),
                "Notas operativas guardadas",
              )
            }
          >
            <Save className="mr-2 h-4 w-4" /> Guardar notas
          </Button>
        </div>
      ) : (
        booking.operations_notes && (
          <p className="mt-4 whitespace-pre-line border-t border-border pt-4 text-sm">
            {booking.operations_notes}
          </p>
        )
      )}
    </div>
  );
}
