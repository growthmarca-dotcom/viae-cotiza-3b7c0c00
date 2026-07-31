import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PlusCircle, Trash2, Wrench } from "lucide-react";
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
import { useAccount } from "@/hooks/use-account";
import { listResources, type Resource } from "@/lib/resources";
import {
  archiveBookingService,
  createBookingService,
  EMPTY_SERVICE,
  listBookingServices,
  listInternalUsers,
  OPERATION_STATUSES,
  operationStatusClasses,
  operationStatusLabel,
  SERVICE_KINDS,
  serviceKindLabel,
  updateBookingService,
  type BookingService,
  type BookingServiceInput,
  type InternalUser,
  type OperationStatus,
  type ServiceKind,
} from "@/lib/operations";

const NONE = "__none__";

/**
 * Panel "Servicios incluidos" de la reserva (v1.8).
 * Sólo la central (administración / Operaciones) puede coordinar; el agente
 * vendedor accede en modo lectura para seguir la evolución de su venta.
 */
export function BookingServicesPanel({ bookingId }: { bookingId: string }) {
  const { isOperations } = useAccount();
  const [services, setServices] = useState<BookingService[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<BookingServiceInput>(EMPTY_SERVICE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listBookingServices(bookingId);
      setServices(list);
      if (isOperations) {
        const [res, internal] = await Promise.all([
          listResources().catch(() => [] as Resource[]),
          listInternalUsers().catch(() => [] as InternalUser[]),
        ]);
        setResources(res);
        setUsers(internal);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los servicios");
    } finally {
      setLoading(false);
    }
  }, [bookingId, isOperations]);

  useEffect(() => {
    load();
  }, [load]);

  const userName = useCallback(
    (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? "Responsable") : "Sin responsable"),
    [users],
  );

  const resourceName = useCallback(
    (id: string | null) => (id ? (resources.find((r) => r.id === id)?.name ?? "Recurso") : null),
    [resources],
  );

  const summary = useMemo(() => {
    const total = services.length;
    const assigned = services.filter(
      (s) => s.resource_id || s.company_id || s.provider_name,
    ).length;
    return { total, assigned, pending: total - assigned };
  }, [services]);

  async function addService() {
    setSaving(true);
    try {
      await createBookingService(bookingId, draft);
      toast.success("Servicio agregado");
      setDraft(EMPTY_SERVICE);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar el servicio");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, input: Partial<BookingServiceInput>) {
    try {
      await updateBookingService(id, input);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el servicio");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando servicios...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Servicios incluidos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.total} servicio(s) · {summary.assigned} con proveedor asignado ·{" "}
              {summary.pending} sin asignar.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            <Wrench className="h-3.5 w-3.5 text-gold" />
            {isOperations ? "Central operativa" : "Vista del vendedor"}
          </span>
        </div>

        {services.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Todavía no hay servicios cargados en esta reserva.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {services.map((s) => (
              <li key={s.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {s.title || serviceKindLabel(s.kind)}{" "}
                      <span className="text-xs text-muted-foreground">
                        · {serviceKindLabel(s.kind)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {resourceName(s.resource_id) ?? s.provider_name ?? "Sin proveedor asignado"}
                      {s.service_date ? ` · ${s.service_date}` : ""} · {userName(s.responsible_user_id)}
                    </p>
                    {s.notes && <p className="mt-2 whitespace-pre-line text-xs">{s.notes}</p>}
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${operationStatusClasses(s.status)}`}
                  >
                    {operationStatusLabel(s.status)}
                  </span>
                </div>

                {isOperations && (
                  <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-4">
                    <Select
                      value={s.status}
                      onValueChange={(v) => patch(s.id, { status: v as OperationStatus })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATION_STATUSES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={s.responsible_user_id ?? NONE}
                      onValueChange={(v) =>
                        patch(s.id, { responsible_user_id: v === NONE ? null : v })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Responsable" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin responsable</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={s.resource_id ?? NONE}
                      onValueChange={(v) => patch(s.id, { resource_id: v === NONE ? null : v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Recurso" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin recurso</SelectItem>
                        {resources.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await archiveBookingService(s.id);
                        toast.success("Servicio archivado");
                        load();
                      }}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Archivar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isOperations && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-display text-lg font-semibold">Agregar servicio</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de servicio</Label>
              <Select
                value={draft.kind}
                onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as ServiceKind }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Detalle</Label>
              <Input
                value={draft.title}
                placeholder="Ej. Hotel 3 noches / Transfer aeropuerto"
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha del servicio</Label>
              <Input
                type="date"
                value={draft.service_date ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, service_date: e.target.value || null }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Proveedor (texto libre)</Label>
              <Input
                value={draft.provider_name ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, provider_name: e.target.value || null }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notas operativas</Label>
              <Textarea
                rows={2}
                value={draft.notes ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value || null }))}
              />
            </div>
          </div>
          <Button className="mt-4" disabled={saving} onClick={addService}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            Agregar servicio
          </Button>
        </div>
      )}
    </div>
  );
}
