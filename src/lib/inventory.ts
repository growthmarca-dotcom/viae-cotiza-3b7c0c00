/**
 * Inventario Global — Fase A (solo tipos y etiquetas).
 *
 * El Inventario Global es el catálogo comercial central: representa lo que se
 * VENDE (hoteles, habitaciones, excursiones, actividades, traslados vendibles,
 * paquetes, rent a car, servicios turísticos).
 *
 * NO reemplaza `resources`, que representa con QUÉ se presta el servicio
 * (vehículos, choferes, equipos, unidades operativas).
 *
 * Esta capa no calcula precios, no consulta disponibilidad, no arma paquetes
 * y no reserva. Solo describe el modelo de datos.
 */

export type ProductCategory =
  | "accommodation"
  | "activity"
  | "excursion"
  | "transfer"
  | "rental"
  | "package"
  | "other";

export type ProductStatus = "draft" | "active" | "inactive" | "archived";

export type ProductMediaType = "image" | "video" | "document";

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  accommodation: "Alojamiento",
  activity: "Actividad",
  excursion: "Excursión",
  transfer: "Traslado",
  rental: "Alquiler",
  package: "Paquete",
  other: "Otro",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  inactive: "Inactivo",
  archived: "Archivado",
};

export const PRODUCT_MEDIA_TYPE_LABELS: Record<ProductMediaType, string> = {
  image: "Imagen",
  video: "Video",
  document: "Documento",
};

export interface Product {
  id: string;
  user_id: string;
  organization_id: string;
  category: ProductCategory;
  name: string;
  description: string | null;
  short_description: string | null;
  status: ProductStatus;
  country: string | null;
  state: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  capacity_min: number;
  capacity_max: number | null;
  duration_minutes: number | null;
  status: ProductStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProductCategoryEntry {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductAttribute {
  id: string;
  product_id: string;
  attribute_key: string;
  attribute_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductMedia {
  id: string;
  product_id: string;
  type: ProductMediaType;
  url: string;
  title: string | null;
  order_index: number;
  created_at: string;
}

/** Etiqueta legible de un producto (para futuras vistas del catálogo). */
export function describeProduct(product: Pick<Product, "name" | "category">): string {
  return `${product.name} · ${PRODUCT_CATEGORY_LABELS[product.category]}`;
}

/** Ubicación resumida del producto en formato es-AR. */
export function formatProductLocation(
  product: Pick<Product, "city" | "state" | "country">,
): string {
  return [product.city, product.state, product.country].filter(Boolean).join(", ");
}
