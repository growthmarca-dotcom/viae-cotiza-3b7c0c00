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
  onSubmit: (args: {
    form: QuotationFormState;
    newFiles: File[];
    keptPaths: string[];
  }) => void | Promise<void>;
  onCancel?: () => void;
};

export function QuotationForm({
  initial,
  existingImages = [],
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
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

  function set<K extends keyof QuotationFormState>(k: K, v: QuotationFormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
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
    if (pn === 0 && n === 0 && t === 0 && oc === 0) return "";
    return String(Math.round((pn * n + t + oc) * 100) / 100);
  }, [form.pricePerNight, form.nights, form.taxes, form.otherCharges]);

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

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Imágenes</h2>
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

      <Section title="Precios">
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
