import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  addBlock,
  addUnit,
  BLOCK_ORIGIN_LABELS,
  getAvailabilityOverview,
  occupiedDays,
  removeBlock,
  removeUnit,
  saveIcalSource,
  setCalendarManaged,
  type AvailabilityUnit,
} from "@/lib/accommodationAvailability";
import { UnitEditDialog } from "@/components/unit-edit-dialog";
import { syncIcalSource } from "@/lib/ical-sync.functions";

const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-AR");
const selCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/** Calendario interno del alojamiento: unidades, bloqueos manuales/automáticos e iCal. */
export function AccommodationAvailabilityPanel({
  productId,
  organizationId,
  canManage,
}: {
  productId: string;
  organizationId: string | null;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const key = ["accommodation-availability", productId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => getAvailabilityOverview(productId) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const run = (fn: () => Promise<unknown>, ok: string) =>
    fn().then(() => { toast.success(ok); refresh(); }).catch((e: Error) => toast.error(e.message));

  const [unitName, setUnitName] = useState("");
  const [viewUnit, setViewUnit] = useState<string>("all");
  const [form, setForm] = useState({ unit: "", from: "", to: "", reason: "" });
  const [icalUrl, setIcalUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState<AvailabilityUnit | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const sync = useServerFn(syncIcalSource);
  const syncM = useMutation({
    mutationFn: (sourceId: string) => sync({ data: { sourceId } }),
    onSuccess: (r) => { toast.success(`iCal sincronizado: ${r.imported} bloqueos`); refresh(); },
    onError: (e: Error) => { toast.error(e.message); refresh(); },
  });

  const units = useMemo(() => (data?.units ?? []).filter((u) => u.status === "active"), [data]);
  const busy = useMemo(
    () => [...occupiedDays(data?.blocks ?? [], data?.units ?? [], viewUnit)].map((d) => new Date(d + "T00:00:00")),
    [data, viewUnit],
  );
  const unitLabel = (id: string | null) => (id ? units.find((u) => u.id === id)?.name ?? "Unidad" : "Todo el alojamiento");

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Cargando disponibilidad…</p>;
  const ical = data.ical;
  const urlValue = icalUrl ?? ical?.url ?? "";

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm" data-testid="availability-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <CalendarDays className="h-5 w-5 text-gold" /> Disponibilidad
          </h2>
          <p className="text-xs text-muted-foreground">
            Información de disponibilidad conocida por ViaE. No confirma reservas automáticamente.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={data.managed}
            disabled={!canManage}
            onCheckedChange={(v) => run(() => setCalendarManaged(productId, data.profileId, v), v ? "Calendario activado" : "Calendario desactivado")}
          />
          Calendario gestionado en ViaE
        </label>
      </div>
      {!data.managed && !ical?.enabled && (
        <p className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
          Sin calendario activo: en las cotizaciones este alojamiento se muestra como "Consultar disponibilidad".
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="space-y-2">
          {units.length > 0 && (
            <select aria-label="Ver unidad" className={selCls} value={viewUnit} onChange={(e) => setViewUnit(e.target.value)}>
              <option value="all">Todo el alojamiento</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <Calendar
            numberOfMonths={1}
            className="rounded-xl border"
            modifiers={{ busy }}
            modifiersClassNames={{
              busy: "rounded-md bg-destructive/85 [&_button]:!bg-transparent [&_button]:font-semibold [&_button]:!text-destructive-foreground",
            }}
          />
          <p className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-destructive/85" /> Bloqueada</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm border" /> Disponible</span>
            {units.length > 0 && <span>· {viewUnit === "all" ? "Todo el alojamiento: rojo solo si todas las unidades están ocupadas" : unitLabel(viewUnit)}</span>}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Unidades / habitaciones</h3>
            {units.length === 0 ? <p className="text-xs text-muted-foreground">Sin unidades: se gestiona como una sola unidad.</p> : <p className="text-xs text-muted-foreground">Estado de hoy. Tocá una unidad para editar sus datos y fotos.</p>}
            <ul className="flex flex-wrap gap-2">
              {units.map((u) => (
                <li key={u.id} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
                  <span title={occupiedDays(data.blocks, data.units, u.id).has(today) ? "Ocupada hoy" : "Disponible hoy"}>
                    {occupiedDays(data.blocks, data.units, u.id).has(today) ? "🔴" : "🟢"}
                  </span>
                  <button type="button" className="hover:underline" onClick={() => setEditing(u)}>{u.name}</button>
                  {canManage && (
                    <button type="button" aria-label={`Quitar ${u.name}`} onClick={() => run(() => removeUnit(u.id), "Unidad quitada")}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canManage && (
              <div className="flex gap-2">
                <Input className="h-9 max-w-xs" placeholder="Ej.: Doble 1" value={unitName} onChange={(e) => setUnitName(e.target.value)} />
                <Button type="button" size="sm" variant="outline" disabled={!unitName.trim()}
                  onClick={() => run(() => addUnit(productId, unitName.trim()), "Unidad agregada").then(() => setUnitName(""))}>
                  Agregar unidad
                </Button>
              </div>
            )}
          </div>

          {canManage && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Nuevo bloqueo manual</h3>
              <div className="flex flex-wrap items-end gap-2">
                {units.length > 0 && (
                  <select aria-label="Unidad" className={selCls} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    <option value="">Todo el alojamiento</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                )}
                <label className="text-xs">Desde<Input type="date" className="h-9" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
                <label className="text-xs">Hasta (salida)<Input type="date" className="h-9" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
                <Input className="h-9 max-w-xs" placeholder="Motivo (ej.: Reserva directa)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                <Button type="button" size="sm"
                  onClick={() => run(() => addBlock({ productId, unitId: form.unit || null, ...form }), "Bloqueo creado").then(() => setForm({ unit: "", from: "", to: "", reason: "" }))}>
                  Marcar ocupado
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Bloqueos</h3>
            {data.blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin fechas ocupadas.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                {data.blocks.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5">
                    <span>
                      {fmt(b.start_date)} → {fmt(b.end_date)} · {unitLabel(b.product_variant_id)}
                      <span className="text-muted-foreground"> · {BLOCK_ORIGIN_LABELS[b.origin]}{b.reason ? ` · ${b.reason}` : ""}</span>
                    </span>
                    {canManage && b.origin === "manual" && (
                      <button type="button" aria-label="Eliminar bloqueo" onClick={() => run(() => removeBlock(b.id), "Bloqueo eliminado")}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canManage && (
            <div className="space-y-2 rounded-xl border border-dashed p-4">
              <h3 className="text-sm font-semibold">Calendario iCal (opcional)</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="h-9 min-w-[260px] flex-1" placeholder="https://…/calendar.ics" value={urlValue} onChange={(e) => setIcalUrl(e.target.value)} />
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={ical?.enabled ?? false}
                    onCheckedChange={(v) => run(() => saveIcalSource({ productId, organizationId, current: ical, url: urlValue, enabled: v }), v ? "iCal activado" : "iCal desactivado")}
                  />
                  Activo
                </label>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => run(() => saveIcalSource({ productId, organizationId, current: ical, url: urlValue, enabled: ical?.enabled ?? true }), "URL guardada").then(() => setIcalUrl(null))}>
                  Guardar
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!ical?.url || syncM.isPending} onClick={() => ical && syncM.mutate(ical.id)}>
                  {syncM.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Sincronizar ahora
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Última sincronización: {ical?.last_sync_at ? new Date(ical.last_sync_at).toLocaleString("es-AR") : "nunca"}
                {ical?.sync_status ? ` · Estado: ${ical.sync_status === "ok" ? "correcto" : `error (${ical.sync_error ?? ""})`}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>
      {canManage && (
        <UnitEditDialog unit={editing} organizationId={organizationId} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
    </section>
  );
}
