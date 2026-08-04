import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
  type SmartQuoteItemRow,
  type SmartQuoteItemType,
} from "@/lib/smartQuotes";

const ITEM_TYPES = Object.keys(SMART_QUOTE_ITEM_TYPE_LABELS) as SmartQuoteItemType[];

/**
 * Constructor manual de ítems (v1.10.9.2). Carga libre de servicios:
 * sin reglas tarifarias, disponibilidad ni proveedores automáticos.
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<SmartQuoteItemType>("accommodation");
  const [quantity, setQuantity] = useState("1");
  const [unitAmount, setUnitAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const total = items.reduce((acc, i) => acc + Number(i.total_amount ?? 0), 0);

  async function add() {
    setSaving(true);
    try {
      await addSmartQuoteItem(smartQuoteId, {
        title,
        description,
        item_type: itemType,
        quantity: Number(quantity),
        unit_amount: Number(unitAmount),
      });
      setTitle("");
      setDescription("");
      setQuantity("1");
      setUnitAmount("");
      toast.success("Ítem agregado");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar el ítem");
    } finally {
      setSaving(false);
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
        <div>
          <h2 className="font-display text-lg font-semibold">Ítems de la cotización</h2>
          <p className="text-xs text-muted-foreground">
            Moneda única de la cotización: <span className="font-medium">{currency}</span>. Todos los
            ítems se cargan en esta moneda.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-medium text-foreground">{formatMoney(currency, total)}</span>
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay ítems cargados. Agregá los servicios manualmente.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{i.title}</p>
                <p className="text-xs text-muted-foreground">
                  {SMART_QUOTE_ITEM_TYPE_LABELS[i.item_type] ?? i.item_type} · {Number(i.quantity)} ×{" "}
                  {formatMoney(i.currency, Number(i.unit_amount ?? 0))}
                </p>
                {i.description && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {i.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium">
                  {formatMoney(i.currency, Number(i.total_amount ?? 0))}
                </span>
                {editable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    disabled={removing === i.id}
                    onClick={() => remove(i.id)}
                  >
                    {removing === i.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="item-title">Nombre</Label>
              <Input
                id="item-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Hotel Llao Llao — habitación doble"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={itemType} onValueChange={(v) => setItemType(v as SmartQuoteItemType)}>
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
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
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
                value={unitAmount}
                onChange={(e) => setUnitAmount(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="item-desc">Descripción</Label>
            <Textarea
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1.5"
            />
          </div>
          <Button onClick={add} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Agregar ítem
          </Button>
        </div>
      )}
    </section>
  );
}
