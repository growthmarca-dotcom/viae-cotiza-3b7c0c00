import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createExtra,
  EMPTY_EXTRA,
  extraToInput,
  listExtras,
  setExtraStatus,
  SUGGESTED_EXTRAS,
  updateExtra,
  type ExtraInput,
  type ResourceExtra,
} from "@/lib/resource-catalog";

/**
 * Catálogo de extras configurable (v1.8.2): cadenas, sillas infantiles,
 * portaesquí, GPS y cualquier adicional que se pueda vincular a un recurso o
 * solicitar en un servicio de transporte.
 */
export function ExtrasManager({ includeArchived }: { includeArchived: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceExtra | null>(null);
  const [form, setForm] = useState<ExtraInput>(EMPTY_EXTRA);
  const [saving, setSaving] = useState(false);

  const extrasQuery = useQuery({
    queryKey: ["resource-extras", includeArchived],
    queryFn: () => listExtras(includeArchived),
  });
  const extras = extrasQuery.data ?? [];

  function set<K extends keyof ExtraInput>(key: K, value: ExtraInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew(name?: string) {
    setEditing(null);
    setForm({ ...EMPTY_EXTRA, name: name ?? "" });
    setOpen(true);
  }

  function openEdit(extra: ResourceExtra) {
    setEditing(extra);
    setForm(extraToInput(extra));
    setOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("El extra necesita un nombre");
      return;
    }
    setSaving(true);
    try {
      if (editing) await updateExtra(editing.id, form);
      else await createExtra(form);
      toast.success(editing ? "Extra actualizado" : "Extra creado");
      setOpen(false);
      extrasQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el extra");
    } finally {
      setSaving(false);
    }
  }

  async function archive(extra: ResourceExtra) {
    try {
      await setExtraStatus(extra.id, extra.record_status === "active" ? "archived" : "active");
      extrasQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el extra");
    }
  }

  const missing = SUGGESTED_EXTRAS.filter(
    (s) => !extras.some((e) => e.name.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Adicionales que pueden vincularse a un recurso (equipamiento disponible) y solicitarse en
          un servicio de transporte.
        </p>
        <Button onClick={() => openNew()}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo extra
        </Button>
      </div>

      {missing.length > 0 && (
        <div className="rounded-2xl border border-dashed border-border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-gold" /> Sugeridos para turismo
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missing.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => openNew(s)}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {extrasQuery.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando extras...
        </div>
      ) : extras.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Todavía no cargaste extras.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {extras.map((e) => (
            <div key={e.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-semibold">{e.name}</h3>
                <span className="rounded-full border border-border px-2.5 py-1 text-xs">
                  {e.is_included ? "Incluido" : "Con cargo"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {e.description ?? "Sin descripción"}
              </p>
              <p className="mt-3 text-sm">
                {e.price != null ? `${e.currency} ${e.price}` : "Sin precio"}
                {e.quantity_available != null ? ` · ${e.quantity_available} disponibles` : ""}
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(e)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => archive(e)}>
                  <Archive className="mr-2 h-4 w-4" />
                  {e.record_status === "active" ? "Archivar" : "Reactivar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editing ? "Editar extra" : "Nuevo extra"}
            </DialogTitle>
            <DialogDescription>
              Definí el adicional, su precio de venta y el costo operativo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(ev) => set("name", ev.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(ev) => set("description", ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Precio de venta</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(ev) => set("price", ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Costo</Label>
              <Input
                type="number"
                min={0}
                value={form.cost}
                onChange={(ev) => set("cost", ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <select
                value={form.currency}
                onChange={(ev) => set("currency", ev.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Cantidad disponible</Label>
              <Input
                type="number"
                min={0}
                value={form.quantity_available}
                onChange={(ev) => set("quantity_available", ev.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox
                checked={form.is_included}
                onCheckedChange={(v) => set("is_included", v === true)}
              />
              Incluido sin cargo
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Guardar cambios" : "Crear extra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
