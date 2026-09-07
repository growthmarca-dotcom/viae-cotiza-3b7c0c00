import { describe, expect, it } from "vitest";
import {
  buildPassengerRows,
  buildServiceRows,
  itemSaleAmount,
  mergeQuotationHeader,
  type QuotationHeader,
} from "@/lib/bookingConversion";

const quotation: QuotationHeader = {
  destination: "Bariloche",
  travel_start: "2026-10-01",
  travel_end: "2026-10-06",
  total_amount: 1500,
  currency: "USD",
  exchange_rate: 1200,
  pax_count: 3,
  guest_first_name: "Ana",
  guest_last_name: "Pérez",
  guest_email: "ana@example.com",
  guest_whatsapp: "+5491100000000",
  accommodation_name: "Hotel Llao Llao",
  accommodation_address: "Av. Bustillo 25",
  organization_id: "org-1",
};

const base = {
  destination: null as string | null,
  travel_start: null as string | null,
  travel_end: null as string | null,
  amount: 0,
  currency: "",
  exchange_rate: null as number | null,
};

describe("cabecera Cotización → Reserva", () => {
  it("completa los datos comerciales faltantes desde la cotización", () => {
    const out = mergeQuotationHeader({ ...base }, quotation);
    expect(out).toMatchObject({
      destination: "Bariloche",
      travel_start: "2026-10-01",
      travel_end: "2026-10-06",
      amount: 1500,
      currency: "USD",
      exchange_rate: 1200,
    });
  });

  it("no sobrescribe lo que cargó el agente", () => {
    const out = mergeQuotationHeader(
      { ...base, destination: "Mendoza", amount: 900, currency: "ARS", exchange_rate: 1 },
      quotation,
    );
    expect(out.destination).toBe("Mendoza");
    expect(out.amount).toBe(900);
    expect(out.currency).toBe("ARS");
    expect(out.exchange_rate).toBe(1);
  });
});

describe("servicios Cotización → Reserva", () => {
  const stamp = {
    applied_exchange_rate: 1200,
    applied_rate_date: "2026-09-07",
    applied_rate_source: "manual" as const,
  };

  it("copia cada ítem con su importe, proveedor y fecha", () => {
    const rows = buildServiceRows({
      bookingId: "b1",
      userId: "u1",
      quotation,
      stamp,
      items: [
        {
          category: "excursion",
          title: "Cerro Catedral",
          provider_name: "Andes Tours",
          service_date: "2026-10-02",
          quantity: 2,
          unit_amount: 100,
          taxes: 21,
        },
        { category: "vehicle_rental", quantity: 1, unit_amount: 300 },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      booking_id: "b1",
      kind: "excursion",
      title: "Cerro Catedral",
      provider_name: "Andes Tours",
      service_date: "2026-10-02",
      sale_amount: 221,
      sale_currency: "USD",
      organization_id: "org-1",
      applied_exchange_rate: 1200,
      applied_rate_source: "inherited",
    });
    expect(rows[1]).toMatchObject({ kind: "car_rental", title: "Servicio", sale_amount: 300 });
  });

  it("conserva el alojamiento de una cotización histórica sin ítems", () => {
    const rows = buildServiceRows({ bookingId: "b1", userId: "u1", quotation, items: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "accommodation",
      title: "Hotel Llao Llao",
      sale_amount: 1500,
      service_date: "2026-10-01",
    });
  });

  it("no inventa servicios cuando no hay nada que copiar", () => {
    expect(
      buildServiceRows({
        bookingId: "b1",
        userId: "u1",
        items: [],
        quotation: { accommodation_name: null, total_amount: 0 },
      }),
    ).toEqual([]);
  });

  it("calcula el importe del ítem con cantidad, tarifa e impuestos", () => {
    expect(itemSaleAmount({ quantity: 3, unit_amount: 10.5, taxes: 2 })).toBe(33.5);
  });
});

describe("pasajeros Cotización → Reserva", () => {
  it("crea titular + acompañantes según el pax cotizado", () => {
    const rows = buildPassengerRows({ bookingId: "b1", userId: "u1", quotation });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      first_name: "Ana",
      last_name: "Pérez",
      email: "ana@example.com",
      is_lead_passenger: true,
    });
    expect(rows[1].is_lead_passenger).toBe(false);
  });

  it("crea el titular aunque la cotización no tenga nombre del huésped", () => {
    const rows = buildPassengerRows({
      bookingId: "b1",
      userId: "u1",
      quotation: { pax_count: 2 },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ first_name: "Titular", is_lead_passenger: true });
  });

  it("no crea pasajeros cuando no hay dato alguno", () => {
    expect(buildPassengerRows({ bookingId: "b1", userId: "u1", quotation: {} })).toEqual([]);
  });
});
