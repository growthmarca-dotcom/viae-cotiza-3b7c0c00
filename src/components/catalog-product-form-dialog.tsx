import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Star, Trash2, Upload } from "lucide-react";
import { CatalogImage } from "@/components/catalog-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVE_CATALOG_CATEGORIES,
  CATALOG_CURRENCIES,
  FUTURE_CATALOG_CATEGORIES,
  PROVIDER_SOURCE_KIND_LABELS,
  SOURCE_TYPES,
  createDestination,
  listCatalogProviders,
  listDestinations,
  validateCatalogInput,
  type CatalogCategory,
  type CatalogInput,
  type SourceType,
  isStoredCatalogImage,
  uploadCatalogImage,
  validateCatalogImageFile,
} from "@/lib/catalog";
import { listMyQuotationOrganizations } from "@/lib/quotations";

type MetaField = { key: string; label: string; type?: "number" | "textarea" | "select"; options?: string[]; wide?: boolean };

/** Campos específicos por categoría (se guardan en products.metadata). */
const META: Partial<Record<CatalogCategory, { title: string; fields: MetaField[] }>> = {
  accommodation: {
    title: "Datos del alojamiento",
    fields: [
      { key: "accommodation_type", label: "Tipo de alojamiento", type: "select", options: ["Hotel", "Cabaña", "Apart hotel", "Hostería", "Departamento", "Hostel", "Lodge", "Otro"] },
      { key: "stars", label: "Categoría / estrellas", type: "select", options: ["1", "2", "3", "4", "5", "Boutique", "Sin categoría"] },
      { key: "address", label: "Dirección", wide: true },
      { key: "maps_url", label: "Ubicación (enlace de Google Maps)", wide: true },
      { key: "website", label: "Sitio web", wide: true },
      { key: "services", label: "Servicios", type: "textarea", wide: true },
      { key: "policies", label: "Políticas", type: "textarea", wide: true },
      { key: "check_in", label: "Check-in" },
      { key: "check_out", label: "Check-out" },
    ],
  },
  excursion: {
    title: "Datos de la excursión / actividad",
    fields: [
      { key: "duration", label: "Duración (ej.: 4 horas, día completo)" },
      { key: "includes", label: "Incluye", type: "textarea", wide: true },
      { key: "excludes", label: "No incluye", type: "textarea", wide: true },
      { key: "requirements", label: "Requisitos", type: "textarea", wide: true },
    ],
  },
  rental: {
    title: "Datos del vehículo",
    fields: [
      { key: "brand", label: "Marca" },
      { key: "model", label: "Modelo" },
      { key: "vehicle_category", label: "Categoría (económico, intermedio…)" },
      { key: "vehicle_type", label: "Tipo de vehículo", type: "select", options: ["Auto", "SUV", "Camioneta", "Van", "4x4", "Otro"] },
      { key: "passengers", label: "Capacidad de pasajeros", type: "number" },
      { key: "luggage", label: "Capacidad de equipaje", type: "number" },
      { key: "transmission", label: "Transmisión", type: "select", options: ["Manual", "Automática"] },
      { key: "fuel", label: "Combustible", type: "select", options: ["Nafta", "Diésel", "Híbrido", "Eléctrico", "GNC"] },
    ],
  },
};
META.activity = META.excursion;

const blank = (orgId = ""): CatalogInput => ({
  organization_id: orgId,
  category: "accommodation",
  name: "",
  short_description: null,
  description: null,
  status: "active",
  provider_id: null,
  internal_code: null,
  external_code: null,
  source_type: "manual",
  external_provider_id: null,
  external_product_id: null,
  cost_amount: null,
  sale_amount: null,
  currency: "USD",
  internal_notes: null,
  metadata: {},
  destination_ids: [],
  images: [],
});

const NONE = "__none__";

export function CatalogProductFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  submitting,
  canSeeCost,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: CatalogInput;
  title: string;
  submitting: boolean;
  canSeeCost: boolean;
  onSubmit: (input: CatalogInput) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<CatalogInput>(initial ?? blank());
  const [newDest, setNewDest] = useState("");
  const [newImg, setNewImg] = useState("");
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const clearPending = () => {
    if (pending) URL.revokeObjectURL(pending.preview);
    setPending(null);
  };
  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateCatalogImageFile(file);
    if (err) return void toast.error(err);
    clearPending();
    setPending({ file, preview: URL.createObjectURL(file) });
  };
  const confirmUpload = async () => {
    if (!pending) return;
    setUploading(true);
    try {
      const ref = await uploadCatalogImage(f.organization_id, pending.file);
      set("images", [...f.images, { url: ref, is_primary: f.images.length === 0 }]);
      clearPending();
      toast.success("Imagen subida");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const { data: orgs = [] } = useQuery({ queryKey: ["my-quotation-organizations"], queryFn: listMyQuotationOrganizations, enabled: open });
  const { data: providers = [] } = useQuery({ queryKey: ["catalog-providers"], queryFn: listCatalogProviders, enabled: open });
  const { data: destinations = [] } = useQuery({ queryKey: ["destinations"], queryFn: listDestinations, enabled: open });

  useEffect(() => {
    if (open) setF(initial ?? blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (open && !f.organization_id && orgs.length === 1) setF((p) => ({ ...p, organization_id: orgs[0].id }));
  }, [open, orgs, f.organization_id]);

  const set = <K extends keyof CatalogInput>(k: K, v: CatalogInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const setMeta = (k: string, v: string) => setF((p) => ({ ...p, metadata: { ...p.metadata, [k]: v } }));
  const txt = (v: string) => (v.trim() === "" ? null : v);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const meta = META[f.category];
  const isEdit = Boolean(initial);

  async function addDestination() {
    if (!f.organization_id) return toast.error("Elegí primero la agencia.");
    try {
      const d = await createDestination({ name: newDest, state: null, organization_id: f.organization_id });
      await qc.invalidateQueries({ queryKey: ["destinations"] });
      set("destination_ids", [...f.destination_ids, d.id]);
      setNewDest("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            const err = validateCatalogInput(f);
            if (err) return toast.error(err);
            onSubmit(f);
          }}
        >
          <section className="grid gap-4 sm:grid-cols-2">
            {orgs.length > 1 && !isEdit && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Agencia propietaria</Label>
                <Select value={f.organization_id} onValueChange={(v) => set("organization_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Elegí la agencia" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={f.category} onValueChange={(v) => set("category", v as CatalogCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVE_CATALOG_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  {FUTURE_CATALOG_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label} (básico)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={f.status} onValueChange={(v) => set("status", v as CatalogInput["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre *</Label>
              <Input value={f.name} maxLength={160} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción corta</Label>
              <Input value={f.short_description ?? ""} maxLength={240} onChange={(e) => set("short_description", txt(e.target.value))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción completa</Label>
              <Textarea rows={4} maxLength={4000} value={f.description ?? ""} onChange={(e) => set("description", txt(e.target.value))} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-display text-lg font-semibold">Destinos</h3>
            <div className="flex flex-wrap gap-2">
              {destinations.map((d) => {
                const on = f.destination_ids.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => set("destination_ids", on ? f.destination_ids.filter((x) => x !== d.id) : [...f.destination_ids, d.id])}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Agregar otro destino" value={newDest} onChange={(e) => setNewDest(e.target.value)} maxLength={80} />
              <Button type="button" variant="outline" onClick={addDestination} disabled={!newDest.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">El primer destino elegido queda como principal.</p>
          </section>

          {meta && (
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold">{meta.title}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {meta.fields.map((m) => {
                  const val = String(f.metadata[m.key] ?? "");
                  return (
                    <div key={m.key} className={`space-y-2 ${m.wide ? "sm:col-span-2" : ""}`}>
                      <Label>{m.label}</Label>
                      {m.type === "textarea" ? (
                        <Textarea rows={2} maxLength={2000} value={val} onChange={(e) => setMeta(m.key, e.target.value)} />
                      ) : m.type === "select" ? (
                        <Select value={val || NONE} onValueChange={(v) => setMeta(m.key, v === NONE ? "" : v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Sin especificar</SelectItem>
                            {m.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input type={m.type ?? "text"} min={m.type === "number" ? 0 : undefined} value={val} maxLength={300} onChange={(e) => setMeta(m.key, e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="font-display text-lg font-semibold">Información comercial</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Proveedor / fuente</Label>
                <Select value={f.provider_id ?? NONE} onValueChange={(v) => set("provider_id", v === NONE ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin proveedor</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.trade_name} · {PROVIDER_SOURCE_KIND_LABELS[p.source_kind] ?? p.source_kind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {providers.length === 0 && (
                  <p className="text-xs text-muted-foreground">Todavía no hay proveedores cargados. Se crean desde Proveedores.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Código interno</Label>
                <Input value={f.internal_code ?? ""} maxLength={60} onChange={(e) => set("internal_code", txt(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Código externo</Label>
                <Input value={f.external_code ?? ""} maxLength={80} onChange={(e) => set("external_code", txt(e.target.value))} />
              </div>
              {canSeeCost && (
                <div className="space-y-2">
                  <Label>Costo del proveedor</Label>
                  <Input type="number" min={0} step="0.01" value={f.cost_amount ?? ""} onChange={(e) => set("cost_amount", num(e.target.value))} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Precio de venta</Label>
                <Input type="number" min={0} step="0.01" value={f.sale_amount ?? ""} onChange={(e) => set("sale_amount", num(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select value={f.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATALOG_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origen</Label>
                <Select value={f.source_type} onValueChange={(v) => set("source_type", v as SourceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observaciones internas</Label>
                <Textarea rows={2} maxLength={2000} value={f.internal_notes ?? ""} onChange={(e) => set("internal_notes", txt(e.target.value))} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-display text-lg font-semibold">Imágenes</h3>
            {f.images.map((img, idx) => (
              <div key={`${img.url}-${idx}`} className="flex items-center gap-3 rounded-xl border border-border p-2">
                <CatalogImage src={img.url} alt={`Imagen ${idx + 1} del producto`} className="h-12 w-16 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{isStoredCatalogImage(img.url) ? "Imagen subida" : img.url}</span>
                <Button
                  type="button"
                  variant={img.is_primary ? "default" : "ghost"}
                  size="sm"
                  onClick={() => set("images", f.images.map((m, i) => ({ ...m, is_primary: i === idx })))}
                >
                  <Star className="mr-1 h-3.5 w-3.5" /> {img.is_primary ? "Principal" : "Hacer principal"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => set("images", f.images.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {pending && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-2">
                <img src={pending.preview} alt="Vista previa de la imagen a subir" className="h-16 w-20 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{pending.file.name}</span>
                <Button type="button" size="sm" disabled={uploading} onClick={confirmUpload}>
                  {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />} Subir imagen
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={clearPending}>
                  Cancelar
                </Button>
              </div>
            )}
            <div>
              <Label htmlFor="catalog-image-file" className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" /> Elegir imagen del dispositivo
              </Label>
              <input id="catalog-image-file" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" onChange={pickFile} />
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG o WebP, hasta 5 MB. También podés pegar una dirección web.</p>
            </div>
            <div className="flex gap-2">
              <Input placeholder="https://… dirección de la imagen" value={newImg} onChange={(e) => setNewImg(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                disabled={!newImg.trim()}
                onClick={() => {
                  if (!/^https?:\/\//i.test(newImg.trim())) return toast.error("Ingresá una dirección que empiece con https://");
                  set("images", [...f.images, { url: newImg.trim(), is_primary: f.images.length === 0 }]);
                  setNewImg("");
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
