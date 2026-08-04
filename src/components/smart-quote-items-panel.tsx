import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { formatMoney } from "@/lib/currency";
import {
  SMART_QUOTE_ITEM_TYPE_LABELS,
  addSmartQuoteItem,
  deleteSmartQuoteItem,
  updateSmartQuoteItem,
  type SmartQuoteItemRow,
  type SmartQuoteItemType,
} from "@/lib/smartQuotes";

const ITEM_TYPES = Object.keys(SMART_QUOTE_ITEM_TYPE_LABELS) as SmartQuoteItemType[];

type Draft = {
  title: string;
  description: string;
  item_type: SmartQuoteItemType;
  quantity: string;
  unit_amount: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  item_type: "accommodation",
  quantity: "1",
  unit_amount: "",
};

function subtotal(draft: Draft): number {
  const q = Number(draft.quantity) || 0;
  const u = Number(draft.unit_amount) || 0;
  return q * u;
}

/**
 * Constructor manual de ítems (v1.10.9.2) con edición inline (v1.12.3).
 * Moneda única de la cabecera: el ítem nunca define su moneda.
 */
export function SmartQuoteItemsPanel({
  smartQuoteId,
  currency,
  items,
  editable,
  onChanged,
}: {
  smartQuoteId: string;
  currency: string;
  items: SmartQuoteItemRow[];
  editable: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);

  const total = items.reduce((acc, i) => acc + Number(i.total_amount ?? 0), 0);

  async function add() {
    setSaving(true);
    try {
      await addSmartQuoteItem(smartQuoteId, {
        title: draft.title,
        description: draft.description,
        item_type: draft.item_type,
        quantity: Number(draft.quantity),
        unit_amount: Number(draft.unit_amount),
      });
      setDraft(EMPTY_DRAFT);
      toast.success("Ítem agregado");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar el ítem");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: SmartQuoteItemRow) {
    setEditingId(item.id);
    setEditDraft({
      title: item.title,
      description: item.description ?? "",
      item_type: item.item_type,
      quantity: String(Number(item.quantity)),
      unit_amount: String(Number(item.unit_amount ?? 0)),
    });
  }

  async function saveEdit(itemId: string) {
    setSavingEdit(true);
    try {
      await updateSmartQuoteItem(smartQuoteId, itemId, {
        title: editDraft.title,
        description: editDraft.description,
        item_type: editDraft.item_type,
        quantity: Number(editDraft.quantity),
        unit_amount: Number(editDraft.unit_amount),
      });
      setEditingId(null);
      toast.success("Ítem actualizado");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el ítem");
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove(id: string) {
    setRemoving(id);
    try {
      await deleteSmartQuoteItem(smartQuoteId, id);
      toast.success("Ítem eliminado");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el ítem");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Ítems de la cotización</h2>
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-medium text-foreground">{formatMoney(currency, total)}</span>
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Moneda única de la cotización: <span className="font-medium text-foreground">{currency}</span>.
        Todos los ítems se cargan en esta moneda.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay ítems cargados. Agregá los servicios manualmente.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) =>
            editingId === i.id ? (
              <li key={i.id} className="space-y-3 rounded-xl border border-gold/40 bg-background p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`edit-title-${i.id}`}>Nombre</Label>
                    <Input
                      id={`edit-title-${i.id}`}
                      value={editDraft.title}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={editDraft.item_type}
                      onValueChange={(v) =>
                        setEditDraft({ ...editDraft, item_type: v as SmartQuoteItemType })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {SMART_QUOTE_ITEM_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`edit-qty-${i.id}`}>Cantidad</Label>
                    <Input
                      id={`edit-qty-${i.id}`}
                      type="number"
                      min="1"
                      value={editDraft.quantity}
                      onChange={(e) => setEditDraft({ ...editDraft, quantity: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-unit-${i.id}`}>Precio unitario ({currency})</Label>
                    <Input
                      id={`edit-unit-${i.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.unit_amount}
                      onChange={(e) => setEditDraft({ ...editDraft, unit_amount: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`edit-desc-${i.id}`}>Descripción</Label>
                  <Textarea
                    id={`edit-desc-${i.id}`}
                    value={editDraft.description}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                    rows={2}
                    className="mt-1.5"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Subtotal:{" "}
                    <span className="font-medium text-foreground">
                      {formatMoney(currency, subtotal(editDraft))}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                      <X className="mr-2 h-4 w-4" /> Cancelar
                    </Button>
                    <Button size="sm" disabled={savingEdit} onClick={() => saveEdit(i.id)}>
                      {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar ítem
                    </Button>
                  </div>
                </div>
              </li>
            ) : (
              <li
                key={i.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {SMART_QUOTE_ITEM_TYPE_LABELS[i.item_type] ?? i.item_type} · {Number(i.quantity)}{" "}
                    × {formatMoney(currency, Number(i.unit_amount ?? 0))}
                  </p>
                  {i.description && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                      {i.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-medium">
                    {formatMoney(currency, Number(i.total_amount ?? 0))}
                  </span>
                  {editable && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Editar ítem"
                        onClick={() => startEdit(i)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label="Eliminar ítem"
                        disabled={removing === i.id}
                        onClick={() => remove(i.id)}
                      >
                        {removing === i.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {editable && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="item-title">Nombre</Label>
              <Input
                id="item-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Hotel Llao Llao — habitación doble"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={draft.item_type}
                onValueChange={(v) => setDraft({ ...draft, item_type: v as SmartQuoteItemType })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SMART_QUOTE_ITEM_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="item-qty">Cantidad</Label>
              <Input
                id="item-qty"
                type="number"
                min="1"
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="item-unit">Precio unitario ({currency})</Label>
              <Input
                id="item-unit"
                type="number"
                min="0"
                step="0.01"
                value={draft.unit_amount}
                onChange={(e) => setDraft({ ...draft, unit_amount: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="item-desc">Descripción</Label>
            <Textarea
              id="item-desc"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className="mt-1.5"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Subtotal:{" "}
              <span className="font-medium text-foreground">
                {formatMoney(currency, subtotal(draft))}
              </span>
            </p>
            <Button onClick={add} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Agregar ítem
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
