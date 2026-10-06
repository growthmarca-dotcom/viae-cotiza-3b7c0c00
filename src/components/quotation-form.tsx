import { PackagePickerButton } from "@/components/package-picker-dialog";
import type { PackagePlan } from "@/lib/packageApply";
import { buildCatalogSnapshot, snapshotDescription, type CatalogProduct } from "@/lib/catalog";
import { emptyItem, type QuotationItemCategory, type QuotationItemDraft } from "@/lib/quotationItems";
import { toast } from "sonner";
import { CatalogPickerButton } from "@/components/catalog-picker-dialog";
import { CatalogImage } from "@/components/catalog-image";
import { useQuery } from "@tanstack/react-query";
import { getCatalogProduct } from "@/lib/catalog";
import { Checkbox } from "@/components/ui/checkbox";
import type { QuotationRecommendation } from "@/lib/recommendations";
import { ACTIVE_CATALOG_CATEGORIES, listCatalogProducts, primaryImage, productDestinationNames } from "@/lib/catalog";
import { PAYMENT_METHOD_OPTIONS, isPromotionAvailable, listPromotions, type QuotationPromotion } from "@/lib/promotions";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
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
import { CURRENCIES, convertTotals, formatMoney, needsExchangeRate } from "@/lib/currency";


export type QuotationFormState = {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  destination: string;
  travelStart: string;
  travelEnd: string;
  nights: string;
  pax: string;
  accommodationName: string;
  /** Producto del Catálogo elegido como alojamiento (su galería se publica). */
  accommodationCatalogProductId?: string;
  address: string;
  description: string;
  services: string;
  cancellationPolicy: string;
  pricePerNight: string;
  taxes: string;
  otherCharges: string;
  totalAmount: string;
  currency: string;
  exchangeRate: string;
  observations: string;
  /** Claves de PAYMENT_METHODS ofrecidas al cliente. */
  paymentMethods?: string[];
  /** Promociones incorporadas: copia del texto al momento de elegirlas. */
  promotions?: QuotationPromotion[];
  /** Recomendados (venta cruzada): no suman al total ni pasan a la reserva. */
  recommendations?: QuotationRecommendation[];
  /** Paquete aplicado (solo referencia histórica: la cotización no depende de él). */
  packageTemplateId?: string;
};


export const EMPTY_QUOTATION: QuotationFormState = {
  firstName: "",
  lastName: "",
  email: "",
  whatsapp: "",
  destination: "",
  travelStart: "",
  travelEnd: "",
  nights: "",
  pax: "",
  accommodationName: "",
  address: "",
  description: "",
  services: "",
  cancellationPolicy: "",
  pricePerNight: "",
  taxes: "",
  otherCharges: "",
  totalAmount: "",
  currency: "USD",
  exchangeRate: "",
  observations: "",
};


export const MAX_IMAGES = 10;

export type ExistingImage = { path: string; url: string };

type Props = {
  initial?: Partial<QuotationFormState>;
  existingImages?: ExistingImage[];
  submitting: boolean;
  submitLabel: string;
  /** Suma de los servicios de otras categorías (cotización integral). */
  itemsTotal?: number;
  /** Constructor de servicios por categoría (recibe la moneda de la cabecera). */
  itemsSlot?: (currency: string) => React.ReactNode;
  /** Resumen general de la cotización (recibe la moneda de la cabecera). */
  summarySlot?: (currency: string) => React.ReactNode;
  /** Bloque informativo (datos precargados desde la consulta). */
  headerSlot?: React.ReactNode;
  onSubmit: (args: {
    form: QuotationFormState;
    newFiles: File[];
    keptPaths: string[];
  }) => void | Promise<void>;
  onCancel?: () => void;
  /** Recibe los servicios (no alojamiento) cargados al aplicar un paquete. */
  onAddPackageItems?: (items: QuotationItemDraft[]) => void;
};

export function QuotationForm({
  initial,
  existingImages = [],
  submitting,
  submitLabel,
  itemsTotal = 0,
  itemsSlot,
  summarySlot,
  headerSlot,
  onSubmit,
  onCancel,
  onAddPackageItems,
}: Props) {
  const [form, setForm] = useState<QuotationFormState>({
    ...EMPTY_QUOTATION,
    ...initial,
  });
  const [kept, setKept] = useState<ExistingImage[]>(existingImages);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    setKept(existingImages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingImages.map((i) => i.path).join("|")]);

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files],
  );

  const catalogProductId = form.accommodationCatalogProductId || "";
  const { data: catalogAcc } = useQuery({
    queryKey: ["catalog-product", catalogProductId],
    queryFn: () => getCatalogProduct(catalogProductId),
    enabled: Boolean(catalogProductId),
  });
  const catalogImages = [...(catalogAcc?.media ?? [])]
    .filter((m) => m.type === "image")
    .sort((a, b) => a.order_index - b.order_index);

  function set<K extends keyof QuotationFormState>(k: K, v: QuotationFormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  // Copia (snapshot): editar el catálogo luego no altera esta cotización.
  function applyAccommodation(p: CatalogProduct) {
    const m = (p.metadata ?? {}) as Record<string, string>;
    setForm((f) => ({
      ...f,
      accommodationName: p.name,
      accommodationCatalogProductId: p.id,
      address: m.address ?? f.address,
      description: p.description ?? p.short_description ?? f.description,
      services: m.services ?? f.services,
      cancellationPolicy: m.policies ?? f.cancellationPolicy,
      pricePerNight: p.sale_amount != null ? String(Number(p.sale_amount)) : f.pricePerNight,
      destination: f.destination || (p.destinations?.[0]?.destinations?.name ?? ""),
    }));
  }

  function applyPackage(plan: PackagePlan<CatalogProduct>, packageId: string, packageName: string) {
    if (plan.accommodation) applyAccommodation(plan.accommodation);
    const mixed = [plan.accommodation, ...plan.services.map((s) => s.product)].some(
      (p) => p && p.currency !== form.currency,
    );
    if (mixed) toast.warning(`Hay productos en otra moneda distinta de ${form.currency}. Revisá las tarifas: no se convierten.`);
    onAddPackageItems?.(
      plan.services.map((s) =>
        emptyItem(s.category as QuotationItemCategory, {
          title: s.product.name,
          description: snapshotDescription(s.product),
          provider_name: s.product.provider?.trade_name ?? "",
          quantity: String(s.quantity),
          unit_amount: s.product.sale_amount != null ? String(Number(s.product.sale_amount)) : "",
          notes: s.required ? "" : "Opcional",
          catalog: buildCatalogSnapshot(s.product),
        }),
      ),
    );
    setForm((f) => ({ ...f, packageTemplateId: packageId }));
    toast.success(`Paquete "${packageName}" cargado. Podés editar cada servicio.`);
  }

  function autoNights(start: string, end: string) {
    if (!start || !end) return;
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) set("nights", String(diff));
  }

  const autoTotal = useMemo(() => {
    const pn = Number(form.pricePerNight) || 0;
    const n = Number(form.nights) || 0;
    const t = Number(form.taxes) || 0;
    const oc = Number(form.otherCharges) || 0;
    const it = Number(itemsTotal) || 0;
    if (pn === 0 && n === 0 && t === 0 && oc === 0 && it === 0) return "";
    return String(Math.round((pn * n + t + oc + it) * 100) / 100);
  }, [form.pricePerNight, form.nights, form.taxes, form.otherCharges, itemsTotal]);

  // El total se mantiene sincronizado con precio por noche, noches, impuestos y otros cargos.
  useEffect(() => {
    if (autoTotal === "") return;
    setForm((p) => (p.totalAmount === autoTotal ? p : { ...p, totalAmount: autoTotal }));
  }, [autoTotal]);

  const totals = useMemo(
    () =>
      convertTotals(
        Number(form.totalAmount || autoTotal) || 0,
        form.currency,
        form.exchangeRate ? Number(form.exchangeRate) : null,
      ),
    [form.totalAmount, form.currency, form.exchangeRate, autoTotal],
  );



  const totalCount = kept.length + files.length;

  function onFilesSelected(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    const room = MAX_IMAGES - totalCount;
    setFiles((prev) => [...prev, ...incoming.slice(0, room)]);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ form, newFiles: files, keptPaths: kept.map((k) => k.path) });
      }}
      className="space-y-6"
    >
      {headerSlot}

      <Section title="Datos del cliente">
        <Field label="Nombre" required>
          <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required maxLength={80} />
        </Field>
        <Field label="Apellido">
          <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} maxLength={80} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={255} />
        </Field>
        <Field label="WhatsApp">
          <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+54 9 11 ..." maxLength={40} />
        </Field>
      </Section>

      <Section title="Viaje">
        <Field label="Destino" className="sm:col-span-2">
          <Input value={form.destination} onChange={(e) => set("destination", e.target.value)} placeholder="Ej: Cancún, México" maxLength={120} />
        </Field>
        <Field label="Fecha de ingreso">
          <Input type="date" value={form.travelStart} onChange={(e) => { set("travelStart", e.target.value); autoNights(e.target.value, form.travelEnd); }} />
        </Field>
        <Field label="Fecha de salida">
          <Input type="date" value={form.travelEnd} onChange={(e) => { set("travelEnd", e.target.value); autoNights(form.travelStart, e.target.value); }} />
        </Field>
        <Field label="Cantidad de noches">
          <Input type="number" min={0} value={form.nights} onChange={(e) => set("nights", e.target.value)} />
        </Field>
        <Field label="Cantidad de pasajeros">
          <Input type="number" min={1} value={form.pax} onChange={(e) => set("pax", e.target.value)} />
        </Field>
      </Section>

      <Section title="Alojamiento">
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <CatalogPickerButton
            categories={["accommodation"]}
            label="Elegir alojamiento del catálogo"
            context={{ destination: form.destination, from: form.travelStart, to: form.travelEnd }}
            onPick={applyAccommodation}
          />
          <span className="text-xs text-muted-foreground">Los datos se copian; podés ajustarlos.</span>
        </div>
        <Field label="Nombre del alojamiento" required className="sm:col-span-2">
          <Input value={form.accommodationName} onChange={(e) => set("accommodationName", e.target.value)} required maxLength={140} />
        </Field>
        <Field label="Dirección" className="sm:col-span-2">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={200} />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Detalles del alojamiento, habitaciones, vistas..." maxLength={2000} />
        </Field>
        <Field label="Servicios" className="sm:col-span-2">
          <Textarea rows={3} value={form.services} onChange={(e) => set("services", e.target.value)} placeholder="Wi-Fi, desayuno, piscina, traslado..." maxLength={1000} />
        </Field>
        <Field label="Política de cancelación" className="sm:col-span-2">
          <Textarea rows={3} value={form.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} maxLength={1000} />
        </Field>
      </Section>



      {catalogImages.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm" data-testid="catalog-accommodation-images">
          <h2 className="font-display text-xl font-semibold">Imágenes del alojamiento</h2>
          <p className="text-sm text-muted-foreground">
            Fotos del Catálogo, en su orden. La primera es la portada. Para cambiarlas, editá el producto en el Catálogo.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {catalogImages.map((m, i) => (
              <div key={m.id} className={`relative overflow-hidden rounded-xl border ${i === 0 ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                <CatalogImage src={m.url} alt={`Foto ${i + 1} del alojamiento`} className="aspect-[4/3] w-full object-cover" />
                <span className="absolute left-1.5 top-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-medium">
                  {i === 0 ? "Portada" : i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Imágenes del alojamiento</h2>
            <p className="text-sm text-muted-foreground">Hasta {MAX_IMAGES} fotografías del alojamiento.</p>

          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            {totalCount} / {MAX_IMAGES}
          </span>
        </div>

        <label
          htmlFor="image-input"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 py-10 text-center transition-colors hover:bg-secondary/60"
        >
          <ImagePlus className="h-8 w-8 text-primary" />
          <span className="text-sm font-medium">Arrastra o haz clic para subir</span>
          <span className="text-xs text-muted-foreground">JPG, PNG, WEBP</span>
          <input
            id="image-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { onFilesSelected(e.target.files); e.target.value = ""; }}
            disabled={totalCount >= MAX_IMAGES}
          />
        </label>

        {(kept.length > 0 || previews.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {kept.map((img, i) => (
              <div key={img.path} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                <img src={img.url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setKept((prev) => prev.filter((k) => k.path !== img.path))}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
                  aria-label="Eliminar imagen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {previews.map((p, i) => (
              <div key={p.url} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                <img src={p.url} alt={`Nueva ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
                  aria-label="Eliminar imagen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      <Section title="Precio del alojamiento">
        <Field label="Precio por noche">
          <Input type="number" min={0} step="0.01" value={form.pricePerNight} onChange={(e) => set("pricePerNight", e.target.value)} />
        </Field>
        <Field label="Impuestos">
          <Input type="number" min={0} step="0.01" value={form.taxes} onChange={(e) => set("taxes", e.target.value)} />
        </Field>
        <Field label="Otros cargos">
          <Input type="number" min={0} step="0.01" value={form.otherCharges} onChange={(e) => set("otherCharges", e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Precio total">
          <Input type="number" min={0} step="0.01" value={form.totalAmount || autoTotal} onChange={(e) => set("totalAmount", e.target.value)} placeholder={autoTotal || "0.00"} />
        </Field>
        <Field label="Moneda">
          <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {needsExchangeRate(form.currency) && (
          <Field label="Tipo de cambio (ARS por 1 USD)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.exchangeRate}
              onChange={(e) => set("exchangeRate", e.target.value)}
              placeholder="Ej: 1200"
            />
          </Field>
        )}
        {(totals.totalArs != null || totals.totalUsd != null) && (
          <div className="sm:col-span-2 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Total en USD</span>
              <span className="font-medium">
                {totals.totalUsd != null ? formatMoney("USD", totals.totalUsd) : "—"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Total en ARS</span>
              <span className="font-medium">
                {totals.totalArs != null ? formatMoney("ARS", totals.totalArs) : "—"}
              </span>
            </div>
            {totals.rate == null && needsExchangeRate(form.currency) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Ingresa el tipo de cambio para ver el equivalente en ARS.
              </p>
            )}
          </div>
        )}
      </Section>

      {onAddPackageItems && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-4" data-testid="add-package">
          <PackagePickerButton onApply={applyPackage} />
          <span className="text-xs text-muted-foreground">
            Carga los productos del paquete como servicios normales, con los precios actuales del Catálogo.
          </span>
        </div>
      )}

      {itemsSlot?.(form.currency)}

      {summarySlot?.(form.currency)}

      <PaymentAndPromotionSection form={form} set={set} />

      <RecommendationsSection form={form} set={set} />


      <Section title="Observaciones" cols={1}>
        <Field label="Notas adicionales">
          <Textarea rows={4} value={form.observations} onChange={(e) => set("observations", e.target.value)} placeholder="Cualquier detalle que quieras dejar registrado." maxLength={2000} />
        </Field>
      </Section>


      <div className="flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
        {onCancel && (
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-5 font-display text-xl font-semibold">{title}</h2>
      <div className={cols === 1 ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>{children}</div>
    </div>
  );
}

function Field({ label, children, required, className }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function PaymentAndPromotionSection({
  form,
  set,
}: {
  form: QuotationFormState;
  set: <K extends keyof QuotationFormState>(k: K, v: QuotationFormState[K]) => void;
}) {
  const { data: promotions = [] } = useQuery({ queryKey: ["promotions"], queryFn: listPromotions });
  const available = promotions.filter((p) => isPromotionAvailable(p));
  const selected = new Set(form.paymentMethods ?? []);
  const chosen = form.promotions ?? [];
  const chosenIds = new Set(chosen.map((p) => p.promotion_id).filter(Boolean));
  // Guardadas en la cotización que ya no están disponibles (inactivas/vencidas): se conservan visibles.
  const savedNotListed = chosen.filter((p) => p.promotion_id && !available.some((a) => a.id === p.promotion_id));
  const specials = chosen.map((p, i) => ({ p, i })).filter(({ p }) => !p.promotion_id);

  function toggle(key: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    set("paymentMethods", PAYMENT_METHOD_OPTIONS.map((m) => m.key as string).filter((k) => next.has(k)).concat(
      [...next].filter((k) => !PAYMENT_METHOD_OPTIONS.some((m) => m.key === k)),
    ));
  }

  function togglePromotion(id: string, on: boolean) {
    if (!on) return set("promotions", chosen.filter((p) => p.promotion_id !== id));
    const p = promotions.find((x) => x.id === id);
    if (!p || chosenIds.has(id)) return;
    // Copia del texto al momento de incorporarla: cambios futuros del catálogo no la alteran.
    set("promotions", [...chosen, { promotion_id: p.id, title: p.title, text: p.description ?? "" }]);
  }

  function updateSpecial(i: number, patch: Partial<QuotationPromotion>) {
    set("promotions", chosen.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  return (
    <Section title="Medios de pago y promoción" cols={1}>
      <Field label="Medios de pago disponibles para el cliente">
        <div className="grid gap-2 sm:grid-cols-3" data-testid="payment-methods">
          {PAYMENT_METHOD_OPTIONS.map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm">
              <Checkbox checked={selected.has(m.key)} onCheckedChange={(v) => toggle(m.key, v === true)} aria-label={m.label} />
              {m.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Promociones disponibles">
        <div className="grid gap-2 sm:grid-cols-2" data-testid="promotion-options">
          {available.length === 0 && savedNotListed.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay promociones activas. Cargalas en la página Promociones.</p>
          )}
          {available.map((p) => (
            <label key={p.id} className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={chosenIds.has(p.id)} onCheckedChange={(v) => togglePromotion(p.id, v === true)} aria-label={p.title} />
              <span>{p.title}</span>
            </label>
          ))}
          {savedNotListed.map((p) => (
            <label key={p.promotion_id!} className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked onCheckedChange={() => togglePromotion(p.promotion_id!, false)} aria-label={p.title} />
              <span>{p.title} <span className="text-xs text-muted-foreground">(ya no disponible)</span></span>
            </label>
          ))}
        </div>
      </Field>
      {specials.map(({ p, i }) => (
        <div key={i} className="grid gap-4 rounded-xl border border-dashed border-border p-4 sm:grid-cols-2">
          <Field label="Promoción especial (solo esta cotización)">
            <Input value={p.title} maxLength={150} onChange={(e) => updateSpecial(i, { title: e.target.value })} placeholder="Bonificación especial por reserva anticipada" />
          </Field>
          <Field label="Texto para el cliente">
            <Textarea rows={2} value={p.text} maxLength={1000} onChange={(e) => updateSpecial(i, { text: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => set("promotions", chosen.filter((_, j) => j !== i))}>
              <X className="mr-1 h-3.5 w-3.5" /> Quitar
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => set("promotions", [...chosen, { promotion_id: null, title: "", text: "" }])}>
          + Promoción especial (solo esta cotización)
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Las promociones son información comercial: no modifican el precio de la cotización.</p>
      </div>
    </Section>
  );
}

const RECOMMENDABLE_CATEGORIES = ACTIVE_CATALOG_CATEGORIES.map((c) => c.value as string);

function RecommendationsSection({
  form,
  set,
}: {
  form: QuotationFormState;
  set: <K extends keyof QuotationFormState>(k: K, v: QuotationFormState[K]) => void;
}) {
  const list = form.recommendations ?? [];
  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog-products"],
    queryFn: listCatalogProducts,
    enabled: list.length > 0,
  });
  const covers: Record<string, string | null> = Object.fromEntries(catalog.map((p) => [p.id, primaryImage(p)]));
  return (
    <Section title="Recomendados" cols={1}>
      <p className="text-sm text-muted-foreground">
        Sugerencias adicionales para el cliente. No forman parte de la propuesta: no suman al total ni pasan a la reserva.
      </p>
      {list.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="recommendations-list">
          {list.map((r) => (
            <li key={r.product_id} className="flex items-start gap-3 rounded-xl border border-dashed border-border p-3">
              {covers[r.product_id] ? (
                <CatalogImage src={covers[r.product_id]!} alt={r.title} className="h-14 w-20 shrink-0 rounded-md object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                {r.destination && <p className="text-xs text-muted-foreground">{r.destination}</p>}
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  Desde $
                  <Input
                    className="h-8 w-32 text-sm"
                    placeholder="Opcional"
                    value={r.from_price ?? ""}
                    aria-label={`Desde $ para ${r.title}`}
                    onChange={(e) =>
                      set(
                        "recommendations",
                        list.map((x) => (x.product_id === r.product_id ? { ...x, from_price: e.target.value } : x)),
                      )
                    }
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Quitar ${r.title}`}
                onClick={() => set("recommendations", list.filter((x) => x.product_id !== r.product_id))}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <CatalogPickerButton
          categories={RECOMMENDABLE_CATEGORIES}
          label="+ Agregar recomendados"
          onPick={(p) => {
            if (list.some((x) => x.product_id === p.id)) return;
            set("recommendations", [
              ...list,
              {
                product_id: p.id,
                title: p.name,
                description: p.short_description ?? p.description ?? "",
                destination: productDestinationNames(p).join(", "),
                from_price: "",
              },
            ]);
          }}
        />
      </div>
    </Section>
  );
}
