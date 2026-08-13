import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/currency";
import {
  CATEGORY_ADD_LABEL,
  QUOTATION_ITEM_CATEGORIES,
  emptyItem,
  itemSubtotal,
  type QuotationItemCategory,
  type QuotationItemDraft,
} from "@/lib/quotationItems";

type FieldKey =
  | "provider_name"
  | "service_date"
  | "end_date"
  | "time_label"
  | "origin"
  | "destination"
  | "quantity"
  | "pax_count";

type FieldDef = { key: FieldKey; label: string; type?: "date" | "number" | "text" };

const F: Record<FieldKey, FieldDef> = {
  provider_name: { key: "provider_name", label: "Proveedor" },
  service_date: { key: "service_date", label: "Fecha", type: "date" },
  end_date: { key: "end_date", label: "Fecha fin", type: "date" },
  time_label: { key: "time_label", label: "Horario" },
  origin: { key: "origin", label: "Origen" },
  destination: { key: "destination", label: "Destino" },
  quantity: { key: "quantity", label: "Cantidad", type: "number" },
  pax_count: { key: "pax_count", label: "Pasajeros", type: "number" },
};

/** Campos visibles y etiquetas propias de cada categoría. */
const CONFIG: Record<
  QuotationItemCategory,
  { titleLabel: string; titlePlaceholder: string; fields: FieldDef[] }
> = {
  accommodation: {
    titleLabel: "Alojamiento",
    titlePlaceholder: "Hotel, cabaña, apart...",
    fields: [
      F.provider_name,
      { ...F.service_date, label: "Check-in" },
      { ...F.end_date, label: "Check-out" },
      { ...F.quantity, label: "Noches" },
      F.pax_count,
    ],
  },
  excursion: {
    titleLabel: "Excursión / servicio",
    titlePlaceholder: "Ej: Excursión Lago",
    fields: [F.provider_name, F.service_date, F.time_label, F.quantity, F.pax_count],
  },
  vehicle_rental: {
    titleLabel: "Vehículo",
    titlePlaceholder: "Ej: SUV automática",
    fields: [
      F.provider_name,
      { ...F.service_date, label: "Fecha de retiro" },
      { ...F.end_date, label: "Fecha de devolución" },
      F.time_label,
      { ...F.origin, label: "Lugar de retiro" },
      { ...F.destination, label: "Lugar de devolución" },
      { ...F.quantity, label: "Cantidad de vehículos" },
      F.pax_count,
    ],
  },
  transfer: {
    titleLabel: "Traslado",
    titlePlaceholder: "Ej: Aeropuerto → Hotel",
    fields: [
      F.provider_name,
      F.service_date,
      F.time_label,
      F.origin,
      F.destination,
      F.quantity,
      F.pax_count,
    ],
  },
  insurance: {
    titleLabel: "Tipo de seguro / cobertura",
    titlePlaceholder: "Ej: Cobertura viajero",
    fields: [
      F.provider_name,
      { ...F.service_date, label: "Desde" },
      { ...F.end_date, label: "Hasta" },
      F.quantity,
      F.pax_count,
    ],
  },
  flight: {
    titleLabel: "Tramo / vuelo",
    titlePlaceholder: "Ej: Ida — BUE → CHP",
    fields: [
      { ...F.provider_name, label: "Aerolínea" },
      F.origin,
      F.destination,
      F.service_date,
      F.time_label,
      F.quantity,
      F.pax_count,
    ],
  },
  other: {
    titleLabel: "Descripción",
    titlePlaceholder: "Servicio adicional",
    fields: [F.provider_name, F.service_date, F.quantity, F.pax_count],
  },
};

/**
 * Constructor de la cotización integral: 7 categorías en pestañas sobre una
 * única cotización. El estado vive en el formulario padre, por lo que cambiar
 * de pestaña nunca pierde información.
 */
export function QuotationItemsTabs({
  currency,
  items,
  onChange,
}: {
  currency: string;
  items: QuotationItemDraft[];
  onChange: (items: QuotationItemDraft[]) => void;
}) {
  function add(category: QuotationItemCategory) {
    onChange([...items, emptyItem(category)]);
  }
  function update(key: string, patch: Partial<QuotationItemDraft>) {
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }
  function remove(key: string) {
    onChange(items.filter((i) => i.key !== key));
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold">Servicios de la cotización</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Una sola cotización con todos los servicios. Los requerimientos de la consulta
          aparecen precargados: completalos con proveedor, producto y tarifa.
        </p>
      </div>

      <Tabs defaultValue="excursion">
        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <TabsList className="w-max">
            {QUOTATION_ITEM_CATEGORIES.filter((c) => c.value !== "accommodation").map((c) => {
              const count = items.filter((i) => i.category === c.value).length;
              return (
                <TabsTrigger key={c.value} value={c.value} className="whitespace-nowrap">
                  {c.label}
                  {count > 0 ? (
                    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">
                      {count}
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {QUOTATION_ITEM_CATEGORIES.filter((c) => c.value !== "accommodation").map((c) => {
          const category = c.value as QuotationItemCategory;
          const cfg = CONFIG[category];
          const list = items.filter((i) => i.category === category);
          return (
            <TabsContent key={category} value={category} className="space-y-4 pt-2">
              {list.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sin servicios de {c.label.toLowerCase()} en esta cotización.
                </p>
              )}

              {list.map((item) => (
                <div key={item.key} className="space-y-4 rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {item.requirement && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                          Requerimiento de la consulta
                        </span>
                      )}
                      <p className="mt-1 text-sm font-medium">
                        Subtotal: {formatMoney(currency, itemSubtotal(item))}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(item.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-sm">{cfg.titleLabel}</Label>
                      <Input
                        value={item.title}
                        placeholder={cfg.titlePlaceholder}
                        maxLength={160}
                        onChange={(e) => update(item.key, { title: e.target.value })}
                      />
                    </div>

                    {cfg.fields.map((f) => (
                      <div key={f.key} className="space-y-2">
                        <Label className="text-sm">{f.label}</Label>
                        <Input
                          type={f.type ?? "text"}
                          min={f.type === "number" ? 0 : undefined}
                          value={item[f.key]}
                          onChange={(e) => update(item.key, { [f.key]: e.target.value })}
                        />
                      </div>
                    ))}

                    <div className="space-y-2">
                      <Label className="text-sm">Tarifa unitaria ({currency})</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unit_amount}
                        onChange={(e) => update(item.key, { unit_amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Impuestos / cargos ({currency})</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.taxes}
                        onChange={(e) => update(item.key, { taxes: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-sm">Observaciones</Label>
                      <Textarea
                        rows={2}
                        maxLength={1000}
                        value={item.notes}
                        onChange={(e) => update(item.key, { notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={() => add(category)}>
                <Plus className="mr-2 h-4 w-4" /> {CATEGORY_ADD_LABEL[category]}
              </Button>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
