import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Lead } from "@/lib/leads";

/**
 * Cotización integral (v1.14): una sola cotización puede reunir servicios de
 * varias categorías. `quotations` conserva la cabecera + el bloque histórico de
 * alojamiento; `quotation_items` agrega el resto de los servicios.
 */
export type QuotationItemRow = Tables<"quotation_items">;

export const QUOTATION_ITEM_CATEGORIES = [
  { value: "accommodation", label: "Alojamiento" },
  { value: "excursion", label: "Excursiones" },
  { value: "vehicle_rental", label: "Alquiler de vehículos" },
  { value: "transfer", label: "Traslados" },
  { value: "insurance", label: "Seguro" },
  { value: "flight", label: "Vuelos" },
  { value: "other", label: "Otros" },
] as const;

export type QuotationItemCategory = (typeof QUOTATION_ITEM_CATEGORIES)[number]["value"];

export const CATEGORY_LABELS: Record<QuotationItemCategory, string> = Object.fromEntries(
  QUOTATION_ITEM_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<QuotationItemCategory, string>;

/** Texto del botón "+ Agregar ..." por categoría. */
export const CATEGORY_ADD_LABEL: Record<QuotationItemCategory, string> = {
  accommodation: "Agregar alojamiento",
  excursion: "Agregar excursión",
  vehicle_rental: "Agregar vehículo",
  transfer: "Agregar traslado",
  insurance: "Agregar seguro",
  flight: "Agregar vuelo",
  other: "Agregar otro",
};

/** Ítem en edición (strings, para trabajar cómodo con inputs controlados). */
export type QuotationItemDraft = {
  /** Presente sólo si el ítem ya existe en la base. */
  id?: string;
  /** Clave local estable para React. */
  key: string;
  category: QuotationItemCategory;
  title: string;
  description: string;
  provider_name: string;
  service_date: string;
  end_date: string;
  time_label: string;
  origin: string;
  destination: string;
  quantity: string;
  pax_count: string;
  unit_amount: string;
  taxes: string;
  notes: string;
  /** true cuando proviene de un requerimiento de la Consulta y aún no fue cotizado. */
  requirement: boolean;
};

let seq = 0;
function localKey() {
  seq += 1;
  return `it-${Date.now()}-${seq}`;
}

export function emptyItem(
  category: QuotationItemCategory,
  overrides: Partial<QuotationItemDraft> = {},
): QuotationItemDraft {
  return {
    key: localKey(),
    category,
    title: "",
    description: "",
    provider_name: "",
    service_date: "",
    end_date: "",
    time_label: "",
    origin: "",
    destination: "",
    quantity: "1",
    pax_count: "",
    unit_amount: "",
    taxes: "",
    notes: "",
    requirement: false,
    ...overrides,
  };
}

export function itemSubtotal(d: QuotationItemDraft): number {
  const q = Number(d.quantity) || 0;
  const u = Number(d.unit_amount) || 0;
  const t = Number(d.taxes) || 0;
  return Math.round((q * u + t) * 100) / 100;
}

export function itemsTotal(items: QuotationItemDraft[]): number {
  return Math.round(items.reduce((acc, i) => acc + itemSubtotal(i), 0) * 100) / 100;
}

export function rowSubtotal(r: QuotationItemRow): number {
  return (
    Math.round((Number(r.quantity ?? 0) * Number(r.unit_amount ?? 0) + Number(r.taxes ?? 0)) * 100) /
    100
  );
}

export function rowsTotal(rows: QuotationItemRow[]): number {
  return Math.round(rows.reduce((acc, r) => acc + rowSubtotal(r), 0) * 100) / 100;
}

export function rowToDraft(r: QuotationItemRow): QuotationItemDraft {
  const details = (r.details ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    key: r.id,
    category: r.category as QuotationItemCategory,
    title: r.title ?? "",
    description: r.description ?? "",
    provider_name: r.provider_name ?? "",
    service_date: r.service_date ?? "",
    end_date: r.end_date ?? "",
    time_label: r.time_label ?? "",
    origin: r.origin ?? "",
    destination: r.destination ?? "",
    quantity: String(Number(r.quantity ?? 1)),
    pax_count: r.pax_count != null ? String(r.pax_count) : "",
    unit_amount: String(Number(r.unit_amount ?? 0)),
    taxes: String(Number(r.taxes ?? 0)),
    notes: r.notes ?? "",
    requirement: details.requirement === true,
  };
}

function draftToPayload(quotationId: string, d: QuotationItemDraft, position: number) {
  const text = (v: string) => (v.trim() === "" ? null : v.trim());
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    quotation_id: quotationId,
    category: d.category,
    title: d.title.trim() || CATEGORY_LABELS[d.category],
    description: text(d.description),
    provider_name: text(d.provider_name),
    service_date: text(d.service_date),
    end_date: text(d.end_date),
    time_label: text(d.time_label),
    origin: text(d.origin),
    destination: text(d.destination),
    quantity: num(d.quantity) ?? 1,
    pax_count: num(d.pax_count),
    unit_amount: num(d.unit_amount) ?? 0,
    taxes: num(d.taxes) ?? 0,
    notes: text(d.notes),
    details: { requirement: d.requirement },
    position,
  };
}

export async function listQuotationItems(quotationId: string): Promise<QuotationItemRow[]> {
  const { data, error } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as QuotationItemRow[];
}

/**
 * Guarda el set completo de ítems de una cotización (reemplazo atómico simple).
 * Se usa tanto al crear como al editar; las cotizaciones sin ítems no se tocan.
 */
export async function saveQuotationItems(quotationId: string, items: QuotationItemDraft[]) {
  const { error: delErr } = await supabase
    .from("quotation_items")
    .delete()
    .eq("quotation_id", quotationId);
  if (delErr) throw delErr;
  if (items.length === 0) return;
  const payload = items.map((d, i) => draftToPayload(quotationId, d, i));
  const { error } = await supabase.from("quotation_items").insert(payload);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Precarga de requerimientos desde la Consulta                        */
/* ------------------------------------------------------------------ */

/** Servicios de interés del Lead → categoría de la cotización. */
export const LEAD_SERVICE_TO_CATEGORY: Record<string, QuotationItemCategory> = {
  accommodation: "accommodation",
  transfers: "transfer",
  excursions: "excursion",
  car_rental: "vehicle_rental",
  flights: "flight",
  insurance: "insurance",
  packages: "other",
  gastronomy: "other",
  other: "other",
};

/**
 * Convierte los servicios solicitados en la Consulta en requerimientos
 * precargados. Un requerimiento NO es todavía un servicio cotizado: el agente
 * completa proveedor, producto concreto, fecha y tarifa.
 */
export function requirementsFromLead(lead: Lead): QuotationItemDraft[] {
  const services = lead.services_interest ?? [];
  const pax = lead.pax_count != null ? String(lead.pax_count) : "";
  const out: QuotationItemDraft[] = [];
  for (const s of services) {
    const category = LEAD_SERVICE_TO_CATEGORY[s];
    // El alojamiento se sigue cargando en el bloque histórico de la cotización.
    if (!category || category === "accommodation") continue;
    out.push(
      emptyItem(category, {
        title: "",
        requirement: true,
        pax_count: pax,
        service_date: lead.travel_date ?? "",
        notes: `Requerimiento de la consulta: ${s}`,
      }),
    );
  }
  return out;
}
