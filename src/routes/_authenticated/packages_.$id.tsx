import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GripVertical, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CatalogPickerButton } from "@/components/catalog-picker-dialog";
import { formatMoney } from "@/lib/currency";
import { ACTIVE_CATALOG_CATEGORIES, listCatalogProducts, type CatalogProduct } from "@/lib/catalog";
import { listMyQuotationOrganizations } from "@/lib/quotations";
import { componentTypeForCategory, moveLine } from "@/lib/packageApply";
import {
  PACKAGE_ITEM_COMPONENT_TYPES,
  PACKAGE_ITEM_COMPONENT_TYPE_LABELS,
  PACKAGE_TEMPLATE_STATUSES,
  PACKAGE_TEMPLATE_STATUS_LABELS,
  createPackage,
  getPackage,
  updatePackage,
  type PackageInput,
  type PackageItemComponentType,
} from "@/lib/packages";

export const Route = createFileRoute("/_authenticated/packages_/$id")({
  component: PackageEditor,
  head: () => ({
    meta: [
      { title: "Paquete — ViaE Sales Hub" },
      { name: "description", content: "Armado de un paquete con productos del Catálogo." },
      { property: "og:title", content: "Paquete — ViaE Sales Hub" },
      { property: "og:description", content: "Armado de un paquete con productos del Catálogo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Line = {
  key: string;
  product_id: string;
  component_type: PackageItemComponentType;
  quantity: string;
  required: boolean;
  order_index: number;
};

const EMPTY: PackageInput = {
  organization_id: "",
  name: "",
  description: "",
  destination_city: "",
  destination_state: "",
  destination_country: "",
  duration_days: null,
  status: "draft",
  priority: 100,
  notes: "",
};

function PackageEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<PackageInput>(EMPTY);
  const [lines, setLines] = useState<Line[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(isNew);

  const { data: orgs = [] } = useQuery({ queryKey: ["my-quotation-orgs"], queryFn: listMyQuotationOrganizations });
  const { data: catalog = [] } = useQuery({ queryKey: ["catalog-products"], queryFn: listCatalogProducts });
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const { data: existing } = useQuery({ queryKey: ["package", id], queryFn: () => getPackage(id), enabled: !isNew });

  useEffect(() => {
    if (isNew && !form.organization_id && orgs.length === 1) setForm((f) => ({ ...f, organization_id: orgs[0].id }));
  }, [orgs, isNew, form.organization_id]);

  useEffect(() => {
    if (!existing) return;
    const p = existing.pkg;
    setForm({
      organization_id: p.organization_id ?? "",
      name: p.name,
      description: p.description ?? "",
      destination_city: p.destination_city ?? "",
      destination_state: p.destination_state ?? "",
      destination_country: p.destination_country ?? "",
      duration_days: p.duration_days,
      status: p.status,
      priority: p.priority,
      notes: String((p.metadata as Record<string, unknown>)?.notes ?? ""),
    });
    setLines(existing.items.map((it) => ({
      key: it.id,
      product_id: it.product_id,
      component_type: it.component_type,
      quantity: String(Number(it.quantity)),
      required: it.required,
      order_index: it.order_index,
    })));
    setLoaded(true);
  }, [existing]);

  const set = <K extends keyof PackageInput>(k: K, v: PackageInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function addProduct(p: CatalogProduct) {
    setLines((l) => [...l, {
      key: `n-${Date.now()}-${l.length}`,
      product_id: p.id,
      component_type: componentTypeForCategory(p.category),
      quantity: "1",
      required: true,
      order_index: l.length,
    }]);
  }
  const update = (key: string, patch: Partial<Line>) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function save() {
    if (!form.organization_id) { toast.error("Elegí la agencia del paquete."); return; }
    setSaving(true);
    try {
      const items = lines.map((l, i) => ({
        product_id: l.product_id,
        component_type: l.component_type,
        quantity: Number(l.quantity),
        required: l.required,
        order_index: i,
      }));
      if (isNew) {
        const newId = await createPackage(form, items);
        toast.success("Paquete creado");
        qc.invalidateQueries({ queryKey: ["packages"] });
        navigate({ to: "/packages/$id", params: { id: newId } });
      } else {
        await updatePackage(id, form, items);
        toast.success("Paquete guardado");
        qc.invalidateQueries({ queryKey: ["packages"] });
        qc.invalidateQueries({ queryKey: ["package", id] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el paquete");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>;
  const last = existing?.last_quoted ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <Link to="/packages" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Paquetes
      </Link>
      <h1 className="font-display text-3xl font-semibold">{isNew ? "Nuevo paquete" : form.name || "Paquete"}</h1>

      {last && (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm shadow-sm" data-testid="package-last-quoted">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Referencia (no fija el precio)</p>
          <p className="mt-1 font-display text-xl font-semibold">
            Último valor cotizado: {last.total_amount != null ? formatMoney(last.currency, last.total_amount) : "—"}
          </p>
          <p className="text-muted-foreground">
            Última cotización: {new Date(last.created_at).toLocaleDateString("es-AR")}
            {last.pax_count ? ` · ${last.pax_count} pasajeros` : ""}
            {last.nights ? ` · ${last.nights} noches` : ""}
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/quotations/$id" params={{ id: last.quotation_id }}>Ver última cotización</Link>
          </Button>
        </div>
      )}

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-2">
        {orgs.length > 1 && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Agencia</Label>
            <Select value={form.organization_id} onValueChange={(v) => set("organization_id", v)}>
              <SelectTrigger><SelectValue placeholder="Elegí la agencia" /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label>Nombre</Label>
          <Input value={form.name} maxLength={140} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Bariloche clásico 5 noches" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Descripción</Label>
          <Textarea rows={3} maxLength={2000} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Ciudad / destino</Label>
          <Input value={form.destination_city ?? ""} maxLength={120} onChange={(e) => set("destination_city", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Provincia</Label>
          <Input value={form.destination_state ?? ""} maxLength={120} onChange={(e) => set("destination_state", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>País</Label>
          <Input value={form.destination_country ?? ""} maxLength={120} onChange={(e) => set("destination_country", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Duración (días)</Label>
          <Input type="number" min={0} value={form.duration_days ?? ""} onChange={(e) => set("duration_days", e.target.value === "" ? null : Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v as PackageInput["status"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PACKAGE_TEMPLATE_STATUSES.map((s) => <SelectItem key={s} value={s}>{PACKAGE_TEMPLATE_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Prioridad (menor = primero)</Label>
          <Input type="number" min={0} value={form.priority} onChange={(e) => set("priority", Number(e.target.value) || 0)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Información adicional (interna)</Label>
          <Textarea rows={2} maxLength={1000} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Productos del paquete</h2>
            <p className="text-sm text-muted-foreground">Arrastrá para ordenar. Se guardan referencias al Catálogo, sin copiar productos.</p>
          </div>
          <CatalogPickerButton
            categories={ACTIVE_CATALOG_CATEGORIES.map((c) => c.value)}
            label="Agregar producto del Catálogo"
            onPick={addProduct}
          />
        </div>

        {lines.length === 0 && <p className="text-sm text-muted-foreground">Todavía no agregaste productos.</p>}
        <ul className="space-y-2">
          {lines.map((l, idx) => {
            const p = byId.get(l.product_id);
            return (
              <li
                key={l.key}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx != null && dragIdx !== idx) setLines((ls) => moveLine(ls, dragIdx, idx)); setDragIdx(null); }}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3"
                data-testid="package-line"
              >
                <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                <span className="w-6 text-xs text-muted-foreground">{idx + 1}</span>
                <div className="min-w-[10rem] flex-1">
                  <p className="font-medium">{p?.name ?? "Producto no disponible en el Catálogo"}</p>
                  {p && (
                    <p className="text-xs text-muted-foreground">
                      Precio actual del Catálogo: {p.sale_amount != null ? formatMoney(p.currency, Number(p.sale_amount)) : "sin precio"}
                    </p>
                  )}
                </div>
                <Select value={l.component_type} onValueChange={(v) => update(l.key, { component_type: v as PackageItemComponentType })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PACKAGE_ITEM_COMPONENT_TYPES.map((t) => <SelectItem key={t} value={t}>{PACKAGE_ITEM_COMPONENT_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  aria-label="Cantidad"
                  value={l.quantity}
                  onChange={(e) => update(l.key, { quantity: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={l.required} onCheckedChange={(v) => update(l.key, { required: v === true })} />
                  Obligatorio
                </label>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild><Link to="/packages">Cancelar</Link></Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar paquete
        </Button>
      </div>
    </div>
  );
}
