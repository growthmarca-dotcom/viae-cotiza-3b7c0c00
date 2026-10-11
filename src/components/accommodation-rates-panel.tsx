import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CURRENCIES } from "@/lib/currency";
import { deleteRatePeriod, findOverlaps, listRatePeriods, saveRatePeriod, type RatePeriod } from "@/lib/accommodationRates";
import type { AvailabilityUnit } from "@/lib/accommodationAvailability";

const fmt = (d: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR") : "—");
const selCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const empty = { name: "", unitId: "", from: "", to: "", currency: "USD", price: "", minNights: "1" };

/** Tarifas por período y estadía mínima, dentro del calendario del alojamiento. */
export function AccommodationRatesPanel({ productId, units, canManage }: { productId: string; units: AvailabilityUnit[]; canManage: boolean }) {
  const qc = useQueryClient();
  const key = ["accommodation-rates", productId];
  const { data: periods = [] } = useQuery({ queryKey: key, queryFn: () => listRatePeriods(productId) });
  const [f, setF] = useState(empty);
  const [editing, setEditing] = useState<RatePeriod | null>(null);
  const overlaps = findOverlaps(periods);
  const unitName = (id: string | null) => (id ? units.find((u) => u.id === id)?.name ?? "Unidad" : "General");

  const save = () =>
    saveRatePeriod(
      productId,
      { name: f.name, unitId: f.unitId || null, from: f.from, to: f.to, currency: f.currency, price: Number(f.price), minNights: Number(f.minNights) },
      editing ?? undefined,
    )
      .then(() => { toast.success(editing ? "Tarifa actualizada" : "Tarifa creada"); setF(empty); setEditing(null); qc.invalidateQueries({ queryKey: key }); })
      .catch((e: Error) => toast.error(e.message));

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Tarifas por fechas</p>
        <p className="text-xs text-muted-foreground">
          Precio por noche y estadía mínima. Se cobran las noches desde la entrada hasta la noche anterior a la salida.
          La tarifa de una unidad tiene prioridad sobre la general.
        </p>
      </div>
      {periods.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin tarifas por fecha: la cotización usa el precio de referencia del Catálogo, que podés ajustar a mano.</p>
      ) : (
        <ul className="divide-y text-sm">
          {periods.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <strong>{p.name}</strong> · {unitName(p.unitId)} · {fmt(p.from)} – {fmt(p.to)} · {p.currency} {p.price.toLocaleString("es-AR")}/noche · mín. {p.minNights} {p.minNights === 1 ? "noche" : "noches"}
                {overlaps.has(p.id) && <span className="ml-2 text-xs font-medium text-destructive">Se superpone con otro período</span>}
              </span>
              {canManage && (
                <span className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" aria-label="Editar tarifa" onClick={() => { setEditing(p); setF({ name: p.name, unitId: p.unitId ?? "", from: p.from, to: p.to, currency: p.currency, price: String(p.price), minNights: String(p.minNights) }); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label="Eliminar tarifa" onClick={() => deleteRatePeriod(p.id).then(() => { toast.success("Tarifa eliminada"); qc.invalidateQueries({ queryKey: key }); }).catch((e: Error) => toast.error(e.message))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="Nombre (ej. Temporada alta)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="sm:col-span-2" />
          <select className={selCls} value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })} aria-label="Unidad">
            <option value="">General (todo el alojamiento)</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className={selCls} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} aria-label="Moneda">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="text-xs text-muted-foreground">Primera noche<Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label className="text-xs text-muted-foreground">Última noche<Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          <label className="text-xs text-muted-foreground">Precio por noche<Input type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
          <label className="text-xs text-muted-foreground">Estadía mínima (noches)<Input type="number" min={1} value={f.minNights} onChange={(e) => setF({ ...f, minNights: e.target.value })} /></label>
          <div className="flex gap-2 sm:col-span-4">
            <Button type="button" size="sm" onClick={save}>{editing ? "Guardar cambios" : "Agregar tarifa"}</Button>
            {editing && <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(null); setF(empty); }}>Cancelar</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
