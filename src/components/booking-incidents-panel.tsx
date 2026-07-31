import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  createIncident,
  EMPTY_INCIDENT,
  INCIDENT_CATEGORIES,
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  incidentCategoryLabel,
  incidentPriorityClasses,
  incidentPriorityLabel,
  incidentStatusClasses,
  incidentStatusLabel,
  listIncidents,
  updateIncident,
  type Incident,
  type IncidentCategory,
  type IncidentInput,
  type IncidentPriority,
  type IncidentStatus,
} from "@/lib/checklist";

/** Centro de incidencias de la reserva (v1.8.1). Gestiona la central operativa. */
export function BookingIncidentsPanel({ bookingId }: { bookingId: string }) {
  const { isOperations } = useAccount();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<IncidentInput>(EMPTY_INCIDENT);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listIncidents(bookingId);
      setIncidents(rows);
      setResolutions(Object.fromEntries(rows.map((r) => [r.id, r.resolution ?? ""])));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las incidencias");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!form.description.trim()) {
      toast.error("Describí la incidencia antes de registrarla");
      return;
    }
    setSaving(true);
    try {
      await createIncident(bookingId, form);
      toast.success("Incidencia registrada");
      setForm(EMPTY_INCIDENT);
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar la incidencia");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, data: Parameters<typeof updateIncident>[1]) {
    try {
      await updateIncident(id, data);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la incidencia");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Centro de incidencias</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOperations
              ? "Registro y seguimiento de problemas durante la preparación y el viaje."
              : "Incidencias registradas por la central operativa para esta reserva."}
          </p>
        </div>
        {isOperations && (
          <Button
            size="sm"
            variant={showForm ? "outline" : "default"}
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="mr-2 h-4 w-4" /> {showForm ? "Cancelar" : "Nueva incidencia"}
          </Button>
        )}
      </div>

      {isOperations && showForm && (
        <div className="mt-6 grid gap-4 rounded-xl border border-border/70 bg-secondary/30 p-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as IncidentCategory }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v as IncidentPriority }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as IncidentStatus }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label>Descripción</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-3">
            <Button size="sm" disabled={saving} onClick={create}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar incidencia
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando incidencias…
          </p>
        ) : incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin incidencias registradas.</p>
        ) : (
          incidents.map((inc) => (
            <div key={inc.id} className="rounded-xl border border-border/70 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-border bg-secondary px-2 py-1">
                  {incidentCategoryLabel(inc.category)}
                </span>
                <span
                  className={`rounded-full border px-2 py-1 font-medium ${incidentPriorityClasses(inc.priority)}`}
                >
                  {incidentPriorityLabel(inc.priority)}
                </span>
                <span
                  className={`rounded-full border px-2 py-1 font-medium ${incidentStatusClasses(inc.status)}`}
                >
                  {incidentStatusLabel(inc.status)}
                </span>
                <span className="text-muted-foreground">
                  {new Date(inc.created_at).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-line text-sm">{inc.description}</p>

              {isOperations ? (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select
                        value={inc.status}
                        onValueChange={(v) => patch(inc.id, { status: v as IncidentStatus })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INCIDENT_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Prioridad</Label>
                      <Select
                        value={inc.priority}
                        onValueChange={(v) => patch(inc.id, { priority: v as IncidentPriority })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INCIDENT_PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Resolución</Label>
                    <Textarea
                      rows={2}
                      value={resolutions[inc.id] ?? ""}
                      onChange={(e) =>
                        setResolutions((r) => ({ ...r, [inc.id]: e.target.value }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(resolutions[inc.id] ?? "") === (inc.resolution ?? "")}
                    onClick={() =>
                      patch(inc.id, { resolution: resolutions[inc.id]?.trim() || null })
                    }
                  >
                    Guardar resolución
                  </Button>
                </div>
              ) : (
                inc.resolution && (
                  <p className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm">
                    <span className="font-medium">Resolución: </span>
                    {inc.resolution}
                  </p>
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
