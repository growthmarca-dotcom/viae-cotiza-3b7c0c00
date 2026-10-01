/**
 * Catálogo ViaE (v1.15) — capa comercial sobre el Inventario Global.
 *
 * Reutiliza `products` (qué se vende), `providers` (proveedor/fuente),
 * `product_media` (imágenes) y suma `destinations` + `product_destinations`.
 * La categoría pertenece al producto; el proveedor/fuente sólo indica el origen.
 *
 * Sin integraciones externas: `source_type`, `external_*` y `last_synced_at`
 * quedan preparados pero no se sincronizan.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CatalogCategory =
  | "accommodation"
  | "excursion"
  | "activity"
  | "rental"
  | "transfer"
  | "insurance"
  | "flight"
  | "other"
  | "package";

/** Categorías con formulario propio en esta etapa. */
export const ACTIVE_CATALOG_CATEGORIES: { value: CatalogCategory; label: string }[] = [
  { value: "accommodation", label: "Alojamiento" },
  { value: "excursion", label: "Excursión / actividad" },
  { value: "rental", label: "Alquiler de vehículo" },
];

/** Preparadas en el modelo; sin formulario específico todavía. */
export const FUTURE_CATALOG_CATEGORIES: { value: CatalogCategory; label: string }[] = [
  { value: "transfer", label: "Traslado" },
  { value: "insurance", label: "Seguro" },
  { value: "flight", label: "Vuelo" },
  { value: "other", label: "Otros" },
];

export const CATALOG_CATEGORY_LABELS: Record<string, string> = {
  accommodation: "Alojamiento",
  excursion: "Excursión",
  activity: "Actividad",
  rental: "Alquiler de vehículo",
  transfer: "Traslado",
  insurance: "Seguro",
  flight: "Vuelo",
  package: "Paquete",
  other: "Otros",
};

export const SOURCE_TYPES = [
  { value: "manual", label: "Manual" },
  { value: "api", label: "API" },
  { value: "feed", label: "Feed" },
  { value: "import", label: "Importación" },
  { value: "other", label: "Otro" },
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number]["value"];
export const SOURCE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_TYPES.map((s) => [s.value, s.label]),
);

export const PROVIDER_SOURCE_KINDS = [
  { value: "direct", label: "Proveedor directo" },
  { value: "wholesaler_b2b", label: "Mayorista B2B" },
  { value: "platform", label: "Plataforma" },
  { value: "api", label: "API" },
  { value: "other", label: "Otro" },
] as const;
export const PROVIDER_SOURCE_KIND_LABELS: Record<string, string> = Object.fromEntries(
  PROVIDER_SOURCE_KINDS.map((s) => [s.value, s.label]),
);

export const COMMERCIAL_ORIGINS = [
  { value: "own", label: "Propio / acuerdo directo" },
  { value: "external", label: "Proveedor externo / mayorista" },
] as const;
export type CommercialOrigin = (typeof COMMERCIAL_ORIGINS)[number]["value"];
export const COMMERCIAL_ORIGIN_LABELS: Record<string, string> = Object.fromEntries(COMMERCIAL_ORIGINS.map((s) => [s.value, s.label]));

export const VISIBILITIES = [
  { value: "private", label: "Privado" },
  { value: "network", label: "Compartido con mi red" },
  { value: "public", label: "Público en ViaE" },
] as const;
export type Visibility = (typeof VISIBILITIES)[number]["value"];
export const VISIBILITY_LABELS: Record<string, string> = Object.fromEntries(VISIBILITIES.map((s) => [s.value, s.label]));

export const SHARING_DECLARATION =
  "Declaro que tengo derecho a comercializar este producto y autorizar su utilización por otras agencias según las condiciones establecidas.";

export async function listAgencyNetworks() {
  const { data, error } = await supabase.from("agency_networks").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

/** Embed de YouTube/Vimeo a partir de la URL; null si no se reconoce. */
export function videoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

/** Reparto de comisión entre agencia vendedora y titular. */
export function sellerCommissionSplit(sale: number | null, pct: number | null) {
  if (sale == null || pct == null) return null;
  const commission = Math.round(sale * pct) / 100;
  return { commission, owner: Math.round((sale - commission) * 100) / 100 };
}

export const CATALOG_CURRENCIES = ["USD", "ARS", "EUR", "BRL", "CLP"] as const;

/** Mapeo categoría del catálogo → categoría del ítem de cotización. */
export const CATALOG_TO_QUOTATION_CATEGORY: Record<string, string> = {
  accommodation: "accommodation",
  excursion: "excursion",
  activity: "excursion",
  rental: "vehicle_rental",
  transfer: "transfer",
  insurance: "insurance",
  flight: "flight",
  other: "other",
  package: "other",
};

export type Destination = Tables<"destinations">;
export type ProductRow = Tables<"products">;
export type ProductMediaRow = Tables<"product_media">;

export type CatalogProduct = ProductRow & {
  provider: { id: string; trade_name: string; source_kind: string } | null;
  owner: { id: string; name: string } | null;
  destinations: { destination_id: string; is_primary: boolean; destinations: { id: string; name: string } | null }[];
  media: ProductMediaRow[];
};

export type CatalogImage = { url: string; is_primary: boolean };

export type CatalogInput = {
  organization_id: string;
  category: CatalogCategory;
  name: string;
  short_description: string | null;
  description: string | null;
  status: "active" | "inactive" | "draft" | "archived";
  provider_id: string | null;
  internal_code: string | null;
  external_code: string | null;
  source_type: SourceType;
  external_provider_id: string | null;
  external_product_id: string | null;
  cost_amount: number | null;
  sale_amount: number | null;
  currency: string;
  internal_notes: string | null;
  metadata: Record<string, unknown>;
  destination_ids: string[];
  images: CatalogImage[];
  commercial_origin: CommercialOrigin;
  visibility: Visibility;
  seller_commission_pct: number | null;
  /** true cuando el usuario aceptó la declaración de derechos al compartir. */
  sharing_declared: boolean;
  video_url: string | null;
};

const SELECT =
  "*, owner:organizations!products_organization_id_fkey(id, name:trade_name), provider:providers(id, trade_name, source_kind), destinations:product_destinations(destination_id, is_primary, destinations(id, name)), media:product_media(*)";

export async function listDestinations(): Promise<Destination[]> {
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createDestination(input: {
  name: string;
  state: string | null;
  organization_id: string;
}): Promise<Destination> {
  const name = input.name.trim();
  if (!name) throw new Error("Ingresá el nombre del destino.");
  const { data, error } = await supabase
    .from("destinations")
    .insert({ name, state: input.state, organization_id: input.organization_id })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Ese destino ya existe.");
    throw new Error(error.message);
  }
  return data;
}

export async function listCatalogProviders() {
  const { data, error } = await supabase
    .from("providers")
    .select("id, trade_name, source_kind, status")
    .neq("status", "archived")
    .order("trade_name");
  if (error) throw error;
  return data ?? [];
}

export async function listCatalogProducts(): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .neq("status", "archived")
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as CatalogProduct[];
}

export async function getCatalogProduct(id: string): Promise<CatalogProduct | null> {
  const { data, error } = await supabase.from("products").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as CatalogProduct) ?? null;
}

export function primaryImage(p: Pick<CatalogProduct, "media">): string | null {
  const imgs = (p.media ?? []).filter((m) => m.type === "image");
  return (imgs.find((m) => m.is_primary) ?? [...imgs].sort((a, b) => a.order_index - b.order_index)[0])?.url ?? null;
}

export function productDestinationNames(p: Pick<CatalogProduct, "destinations">): string[] {
  const list = [...(p.destinations ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  return list.map((d) => d.destinations?.name).filter(Boolean) as string[];
}

function friendly(error: { code?: string; message: string }): Error {
  if (error.code === "23505") return new Error("Ya existe un producto con ese código interno.");
  if (error.code === "42501") return new Error("No tenés permisos para modificar este catálogo.");
  return new Error(error.message);
}

export function validateCatalogInput(i: CatalogInput): string | null {
  if (!i.name.trim()) return "El nombre es obligatorio.";
  if (!i.organization_id) return "Falta la agencia propietaria.";
  if (i.cost_amount != null && (Number.isNaN(i.cost_amount) || i.cost_amount < 0)) return "El costo no es válido.";
  if (i.sale_amount != null && (Number.isNaN(i.sale_amount) || i.sale_amount < 0)) return "El precio de venta no es válido.";
  if (i.commercial_origin === "external" && i.visibility !== "private")
    return "Los productos de proveedores externos o mayoristas no pueden compartirse.";
  if (i.visibility !== "private" && !i.sharing_declared) return "Aceptá la declaración de derechos para compartir el producto.";
  if (i.seller_commission_pct != null && (Number.isNaN(i.seller_commission_pct) || i.seller_commission_pct < 0 || i.seller_commission_pct > 100))
    return "La comisión debe estar entre 0 y 100%.";
  if (i.video_url && !/^https?:\/\//i.test(i.video_url)) return "El video debe ser una dirección web (https://...).";
  for (const img of i.images) {
    if (!/^https?:\/\//i.test(img.url) && !isStoredCatalogImage(img.url)) return "Las imágenes deben ser direcciones web (https://...).";
  }
  return null;
}

async function replaceChildren(productId: string, i: CatalogInput) {
  const { error: dErr } = await supabase.from("product_destinations").delete().eq("product_id", productId);
  if (dErr) throw friendly(dErr);
  if (i.destination_ids.length) {
    const { error } = await supabase.from("product_destinations").insert(
      i.destination_ids.map((destination_id, idx) => ({ product_id: productId, destination_id, is_primary: idx === 0 })),
    );
    if (error) throw friendly(error);
  }
  const { error: mErr } = await supabase.from("product_media").delete().eq("product_id", productId);
  if (mErr) throw friendly(mErr);
  if (i.images.length) {
    const hasPrimary = i.images.some((m) => m.is_primary);
    const { error } = await supabase.from("product_media").insert(
      i.images.map((m, idx) => ({
        product_id: productId,
        type: "image" as const,
        url: m.url.trim(),
        order_index: idx,
        is_primary: hasPrimary ? m.is_primary : idx === 0,
      })),
    );
    if (error) throw friendly(error);
  }
}

function toRow(i: CatalogInput) {
  return {
    organization_id: i.organization_id,
    category: i.category,
    name: i.name.trim(),
    short_description: i.short_description,
    description: i.description,
    status: i.status,
    provider_id: i.provider_id,
    internal_code: i.internal_code,
    external_code: i.external_code,
    source_type: i.source_type,
    external_provider_id: i.external_provider_id,
    external_product_id: i.external_product_id,
    cost_amount: i.cost_amount,
    sale_amount: i.sale_amount,
    currency: i.currency,
    internal_notes: i.internal_notes,
    metadata: i.metadata as never,
    commercial_origin: i.commercial_origin,
    visibility: i.commercial_origin === "external" ? ("private" as const) : i.visibility,
    seller_commission_pct: i.visibility === "private" ? null : i.seller_commission_pct,
    sharing_declared_at: i.visibility !== "private" && i.sharing_declared ? new Date().toISOString() : null,
    video_url: i.video_url?.trim() || null,
  };
}

export async function createCatalogProduct(i: CatalogInput): Promise<string> {
  const v = validateCatalogInput(i);
  if (v) throw new Error(v);
  const { data, error } = await supabase.from("products").insert(toRow(i)).select("id").single();
  if (error) throw friendly(error);
  await replaceChildren(data.id, i);
  return data.id;
}

export async function updateCatalogProduct(id: string, i: CatalogInput): Promise<void> {
  const v = validateCatalogInput(i);
  if (v) throw new Error(v);
  const { error } = await supabase.from("products").update(toRow(i)).eq("id", id);
  if (error) throw friendly(error);
  await replaceChildren(id, i);
}

export async function setCatalogProductStatus(id: string, status: "active" | "inactive" | "archived") {
  const { error } = await supabase.from("products").update({ status }).eq("id", id);
  if (error) throw friendly(error);
}

export async function deleteCatalogProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw friendly(error);
}

export function productToInput(p: CatalogProduct): CatalogInput {
  return {
    organization_id: p.organization_id,
    category: p.category as CatalogCategory,
    name: p.name,
    short_description: p.short_description,
    description: p.description,
    status: p.status,
    provider_id: p.provider_id,
    internal_code: p.internal_code,
    external_code: p.external_code,
    source_type: p.source_type as SourceType,
    external_provider_id: p.external_provider_id,
    external_product_id: p.external_product_id,
    cost_amount: p.cost_amount != null ? Number(p.cost_amount) : null,
    sale_amount: p.sale_amount != null ? Number(p.sale_amount) : null,
    currency: p.currency,
    internal_notes: p.internal_notes,
    metadata: (p.metadata ?? {}) as Record<string, unknown>,
    destination_ids: [...(p.destinations ?? [])]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((d) => d.destination_id),
    images: [...(p.media ?? [])]
      .filter((m) => m.type === "image")
      .sort((a, b) => a.order_index - b.order_index)
      .map((m) => ({ url: m.url, is_primary: m.is_primary })),
    commercial_origin: p.commercial_origin,
    visibility: p.visibility,
    seller_commission_pct: p.seller_commission_pct != null ? Number(p.seller_commission_pct) : null,
    sharing_declared: Boolean(p.sharing_declared_at),
    video_url: p.video_url,
  };
}

export async function duplicateCatalogProduct(p: CatalogProduct): Promise<string> {
  const base = productToInput(p);
  return createCatalogProduct({
    ...base,
    name: `${p.name} (copia)`,
    internal_code: null,
    status: "draft",
    source_type: "manual",
    external_provider_id: null,
    external_product_id: null,
    external_code: null,
    visibility: "private",
    sharing_declared: false,
  });
}

/* ------------------------------------------------------------------ */
/* Snapshot para cotizaciones                                          */
/* ------------------------------------------------------------------ */

/**
 * Copia inmutable de los datos comerciales usados en una cotización.
 * Se guarda en `quotation_items.details.catalog`: cambios posteriores del
 * catálogo nunca alteran cotizaciones históricas.
 */
export type CatalogSnapshot = {
  product_id: string;
  name: string;
  category: string;
  short_description: string | null;
  description: string | null;
  sale_amount: number | null;
  cost_amount: number | null;
  currency: string;
  provider_id: string | null;
  provider_name: string | null;
  internal_code: string | null;
  external_code: string | null;
  source_type: string;
  destinations: string[];
  metadata: Record<string, unknown>;
  captured_at: string;
  /** Agencia titular del producto (no cambia aunque otra agencia lo venda). */
  owner_organization_id?: string;
  owner_organization_name?: string | null;
  commercial_origin?: string;
  visibility?: string;
  seller_commission_pct?: number | null;
  /** Comisión de la agencia vendedora sobre sale_amount (solo registro). */
  seller_commission_amount?: number | null;
  owner_amount?: number | null;
};

export function buildCatalogSnapshot(p: CatalogProduct): CatalogSnapshot {
  const split = p.visibility !== "private"
    ? sellerCommissionSplit(p.sale_amount != null ? Number(p.sale_amount) : null, p.seller_commission_pct != null ? Number(p.seller_commission_pct) : null)
    : null;
  return {
    product_id: p.id,
    name: p.name,
    category: p.category,
    short_description: p.short_description,
    description: p.description,
    sale_amount: p.sale_amount != null ? Number(p.sale_amount) : null,
    cost_amount: p.cost_amount != null ? Number(p.cost_amount) : null,
    currency: p.currency,
    provider_id: p.provider_id,
    provider_name: p.provider?.trade_name ?? null,
    internal_code: p.internal_code,
    external_code: p.external_code,
    source_type: p.source_type,
    destinations: productDestinationNames(p),
    metadata: (p.metadata ?? {}) as Record<string, unknown>,
    captured_at: new Date().toISOString(),
    owner_organization_id: p.organization_id,
    owner_organization_name: p.owner?.name ?? null,
    commercial_origin: p.commercial_origin,
    visibility: p.visibility,
    seller_commission_pct: p.seller_commission_pct != null ? Number(p.seller_commission_pct) : null,
    seller_commission_amount: split?.commission ?? null,
    owner_amount: split?.owner ?? null,
  };
}

/** Texto descriptivo para el ítem de cotización según la categoría. */
export function snapshotDescription(p: CatalogProduct): string {
  const m = (p.metadata ?? {}) as Record<string, string>;
  if (p.category === "rental") {
    return [m.brand, m.model, m.transmission, m.fuel, m.passengers ? `${m.passengers} pasajeros` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  return p.short_description ?? "";
}

/* ------------------------------------------------------------------ */
/* Imágenes propias (bucket privado catalog-images)                    */
/* ------------------------------------------------------------------ */

const IMAGE_PREFIX = "storage://catalog-images/";
export const CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CATALOG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function isStoredCatalogImage(url: string): boolean {
  return url.startsWith(IMAGE_PREFIX);
}

export function validateCatalogImageFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!CATALOG_IMAGE_TYPES.includes(file.type) || !["jpg", "jpeg", "png", "webp"].includes(ext))
    return "Formato no admitido. Usá JPG, PNG o WebP.";
  if (file.size > CATALOG_IMAGE_MAX_BYTES) return "La imagen supera los 5 MB.";
  return null;
}

/** Sube el archivo y devuelve la referencia que se guarda en product_media.url. */
export async function uploadCatalogImage(organizationId: string, file: File): Promise<string> {
  const v = validateCatalogImageFile(file);
  if (v) throw new Error(v);
  if (!organizationId) throw new Error("Elegí la agencia antes de subir imágenes.");
  const ext = file.name.split(".").pop()!.toLowerCase();
  const path = `${organizationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("catalog-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    const msg = /row-level security|unauthorized|403/i.test(error.message)
      ? "No tenés permisos para subir imágenes en esta agencia."
      : `No se pudo subir la imagen: ${error.message}`;
    throw new Error(msg);
  }
  return IMAGE_PREFIX + path;
}

export async function resolveCatalogImageUrl(ref: string): Promise<string | null> {
  if (!isStoredCatalogImage(ref)) return ref;
  const { data, error } = await supabase.storage
    .from("catalog-images")
    .createSignedUrl(ref.slice(IMAGE_PREFIX.length), 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
