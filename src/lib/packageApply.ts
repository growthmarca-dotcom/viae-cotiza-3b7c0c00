/**
 * Lógica pura de Paquetes (sin acceso a la base) para poder testearla.
 * Un paquete es una plantilla de referencias a productos del Catálogo: al
 * aplicarlo a una cotización se cargan servicios normales con los precios
 * ACTUALES del Catálogo, y la cotización queda independiente del paquete.
 */

export type PackageComponentType =
  | "accommodation"
  | "activity"
  | "excursion"
  | "transfer"
  | "rental"
  | "other";

/** Tipo de servicio sugerido según la categoría del producto del Catálogo. */
export function componentTypeForCategory(category: string): PackageComponentType {
  switch (category) {
    case "accommodation":
      return "accommodation";
    case "excursion":
      return "excursion";
    case "activity":
      return "activity";
    case "transfer":
      return "transfer";
    case "rental":
      return "rental";
    default:
      return "other";
  }
}

/** Tipo de servicio del paquete → sección de la cotización normal. */
export const COMPONENT_TO_QUOTATION_CATEGORY: Record<PackageComponentType, string> = {
  accommodation: "accommodation",
  activity: "excursion",
  excursion: "excursion",
  transfer: "transfer",
  rental: "vehicle_rental",
  other: "other",
};

export type PackageLine<P> = {
  product: P | null;
  component_type: PackageComponentType;
  quantity: number;
  order_index: number;
  required: boolean;
};

export type PackagePlan<P> = {
  /** Primer alojamiento del paquete: va al bloque de alojamiento. */
  accommodation: P | null;
  /** Resto de los servicios, en el orden del paquete. */
  services: { category: string; product: P; quantity: number; required: boolean }[];
  /** Alojamientos adicionales (la cotización tiene un solo bloque de alojamiento). */
  extraAccommodations: P[];
  /** Productos que ya no están disponibles en el Catálogo. */
  missing: number;
};

export function planPackageApplication<P>(lines: PackageLine<P>[]): PackagePlan<P> {
  const sorted = [...lines].sort((a, b) => a.order_index - b.order_index);
  const plan: PackagePlan<P> = { accommodation: null, services: [], extraAccommodations: [], missing: 0 };
  for (const l of sorted) {
    if (!l.product) {
      plan.missing += 1;
      continue;
    }
    if (l.component_type === "accommodation") {
      if (!plan.accommodation) plan.accommodation = l.product;
      else plan.extraAccommodations.push(l.product);
      continue;
    }
    plan.services.push({
      category: COMPONENT_TO_QUOTATION_CATEGORY[l.component_type] ?? "other",
      product: l.product,
      quantity: l.quantity > 0 ? l.quantity : 1,
      required: l.required,
    });
  }
  return plan;
}

/** Reordena tras arrastrar y renumera order_index 0..n-1. */
export function moveLine<T extends { order_index: number }>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next.map((l, i) => ({ ...l, order_index: i }));
}

export type LastQuoted = {
  quotation_id: string;
  quotation_number: string | null;
  total_amount: number | null;
  currency: string;
  created_at: string;
  pax_count: number | null;
  nights: number | null;
};

/** Última cotización (más reciente) por paquete. Solo referencia, no fija precio. */
export function lastQuotedByPackage(
  rows: (LastQuoted & { package_template_id: string | null })[],
): Map<string, LastQuoted> {
  const map = new Map<string, LastQuoted>();
  for (const r of rows) {
    if (!r.package_template_id) continue;
    const prev = map.get(r.package_template_id);
    if (!prev || new Date(r.created_at) > new Date(prev.created_at)) {
      const { package_template_id: _p, ...rest } = r;
      map.set(r.package_template_id, rest);
    }
  }
  return map;
}
