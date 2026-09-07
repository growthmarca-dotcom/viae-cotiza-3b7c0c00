/**
 * Conversión Cotización → Reserva (flujo comercial V1).
 *
 * Este módulo contiene únicamente lógica pura (sin acceso a la base) para poder
 * testear el traslado de información de la cotización a la reserva:
 * cabecera, servicios y pasajeros. La escritura sigue viviendo en
 * `src/lib/bookings.ts`.
 */

/** Categoría de `quotation_items` -> tipo de servicio operativo. */
export const ITEM_CATEGORY_TO_SERVICE_KIND: Record<string, string> = {
  accommodation: "accommodation",
  excursion: "excursion",
  vehicle_rental: "car_rental",
  transfer: "transfer",
  insurance: "insurance",
  flight: "flight",
  other: "other",
};

export type QuotationHeader = {
  destination?: string | null;
  travel_start?: string | null;
  travel_end?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  exchange_rate?: number | null;
  pax_count?: number | null;
  guest_first_name?: string | null;
  guest_last_name?: string | null;
  guest_email?: string | null;
  guest_whatsapp?: string | null;
  accommodation_name?: string | null;
  accommodation_address?: string | null;
  organization_id?: string | null;
};

export type QuotationItemLike = {
  category?: string | null;
  title?: string | null;
  description?: string | null;
  provider_name?: string | null;
  service_date?: string | null;
  quantity?: number | string | null;
  unit_amount?: number | string | null;
  taxes?: number | string | null;
  notes?: string | null;
};

export type RateStamp = {
  applied_exchange_rate: number | null;
  applied_rate_date: string | null;
  applied_rate_source: "manual" | "snapshot" | "inherited" | null;
};

const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);

/**
 * Completa los datos comerciales de la cabecera de la reserva que el
 * formulario no envió, sin sobrescribir nunca lo que el agente cargó.
 */
export function mergeQuotationHeader<
  T extends {
    destination: string | null;
    travel_start: string | null;
    travel_end: string | null;
    amount: number;
    currency: string;
    exchange_rate: number | null;
  },
>(input: T, q: QuotationHeader | null | undefined): T {
  if (!q) return input;
  return {
    ...input,
    destination: input.destination ?? q.destination ?? null,
    travel_start: input.travel_start ?? q.travel_start ?? null,
    travel_end: input.travel_end ?? q.travel_end ?? null,
    amount: input.amount > 0 ? input.amount : num(q.total_amount),
    currency: input.currency || q.currency || "USD",
    exchange_rate: input.exchange_rate ?? q.exchange_rate ?? null,
  };
}

export function itemSaleAmount(i: QuotationItemLike): number {
  return Math.round((num(i.quantity) * num(i.unit_amount) + num(i.taxes)) * 100) / 100;
}

/**
 * Servicios de la reserva a partir de los ítems de la cotización. Cuando la
 * cotización es histórica (modelo plano, sin ítems) se genera un único servicio
 * de alojamiento con el bloque cotizado, para no perder la información original.
 */
export function buildServiceRows(args: {
  bookingId: string;
  userId: string;
  items: QuotationItemLike[];
  quotation: QuotationHeader | null | undefined;
  stamp?: RateStamp;
}) {
  const { bookingId, userId, items, quotation, stamp } = args;
  const common = {
    booking_id: bookingId,
    user_id: userId,
    organization_id: quotation?.organization_id ?? null,
    sale_currency: quotation?.currency ?? null,
    applied_exchange_rate: stamp?.applied_exchange_rate ?? null,
    applied_rate_date: stamp?.applied_rate_date ?? null,
    applied_rate_source:
      stamp?.applied_exchange_rate != null ? ("inherited" as const) : null,
  };

  if (items.length > 0) {
    return items.map((i) => ({
      ...common,
      kind: ITEM_CATEGORY_TO_SERVICE_KIND[String(i.category ?? "other")] ?? "other",
      title: (i.title ?? "").trim() || "Servicio",
      provider_name: i.provider_name ?? null,
      service_date: i.service_date ?? null,
      notes: i.notes ?? i.description ?? null,
      sale_amount: itemSaleAmount(i),
    }));
  }

  // Cotización histórica: se conserva el alojamiento cotizado como servicio.
  const name = (quotation?.accommodation_name ?? "").trim();
  const total = num(quotation?.total_amount);
  if (!name && total <= 0) return [];
  return [
    {
      ...common,
      kind: "accommodation",
      title: name || "Alojamiento cotizado",
      provider_name: null,
      service_date: quotation?.travel_start ?? null,
      notes: quotation?.accommodation_address ?? null,
      sale_amount: total,
    },
  ];
}

/**
 * Pasajeros de la reserva: titular de la cotización + acompañantes según el
 * `pax_count` cotizado. Los acompañantes son marcadores nominativos para que la
 * operación sepa cuánta gente viaja.
 */
export function buildPassengerRows(args: {
  bookingId: string;
  userId: string;
  quotation: QuotationHeader | null | undefined;
}) {
  const { bookingId, userId, quotation } = args;
  const firstName = (quotation?.guest_first_name ?? "").trim();
  const lastName = (quotation?.guest_last_name ?? "").trim();
  const paxCount = Number(quotation?.pax_count ?? 0) || 0;
  if (!firstName && !lastName && paxCount <= 0) return [];
  const paxTotal = Math.max(1, paxCount);
  return [
    {
      booking_id: bookingId,
      user_id: userId,
      first_name: firstName || "Titular",
      last_name: lastName || "—",
      email: quotation?.guest_email ?? null,
      phone: quotation?.guest_whatsapp ?? null,
      is_lead_passenger: true,
    },
    ...Array.from({ length: paxTotal - 1 }, (_, i) => ({
      booking_id: bookingId,
      user_id: userId,
      first_name: `Acompañante ${i + 2}`,
      last_name: "—",
      is_lead_passenger: false,
      relationship_to_lead_passenger: "Acompañante",
      notes: "Datos pendientes de completar (generado desde la cotización).",
    })),
  ];
}
