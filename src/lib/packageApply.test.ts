import { describe, expect, it } from "vitest";
import {
  componentTypeForCategory,
  lastQuotedByPackage,
  moveLine,
  planPackageApplication,
  type PackageLine,
} from "./packageApply";

type P = { id: string; name: string; sale_amount: number; currency: string };
const hotel: P = { id: "h", name: "Hotel", sale_amount: 100, currency: "USD" };
const hotel2: P = { id: "h2", name: "Hotel 2", sale_amount: 90, currency: "USD" };
const exc: P = { id: "e", name: "Excursión", sale_amount: 50, currency: "USD" };
const car: P = { id: "c", name: "Auto", sale_amount: 70, currency: "USD" };
const tr: P = { id: "t", name: "Traslado", sale_amount: 20, currency: "USD" };

const line = (product: P | null, t: PackageLine<P>["component_type"], order: number, qty = 1, req = true): PackageLine<P> => ({
  product, component_type: t, order_index: order, quantity: qty, required: req,
});

describe("planPackageApplication", () => {
  it("manda el alojamiento a su bloque y el resto a su sección, en orden", () => {
    const plan = planPackageApplication([
      line(tr, "transfer", 2, 2),
      line(exc, "excursion", 1, 3, false),
      line(hotel, "accommodation", 0),
      line(car, "rental", 3),
    ]);
    expect(plan.accommodation).toBe(hotel);
    expect(plan.services.map((s) => [s.category, s.product.id, s.quantity, s.required])).toEqual([
      ["excursion", "e", 3, false],
      ["transfer", "t", 2, true],
      ["vehicle_rental", "c", 1, true],
    ]);
  });

  it("referencia el mismo objeto del catálogo (no copia ni fija precios del paquete)", () => {
    const plan = planPackageApplication([line(exc, "activity", 0)]);
    expect(plan.services[0].product).toBe(exc);
    expect(plan.services[0].category).toBe("excursion");
  });

  it("informa productos que ya no están y alojamientos extra", () => {
    const plan = planPackageApplication([line(hotel, "accommodation", 0), line(hotel2, "accommodation", 1), line(null, "other", 2)]);
    expect(plan.extraAccommodations).toEqual([hotel2]);
    expect(plan.missing).toBe(1);
  });

  it("aplicar dos veces no muta las líneas del paquete", () => {
    const lines = [line(exc, "excursion", 0, 2)];
    planPackageApplication(lines);
    planPackageApplication(lines);
    expect(lines[0].quantity).toBe(2);
  });
});

describe("helpers", () => {
  it("tipo sugerido según categoría", () => {
    expect(componentTypeForCategory("rental")).toBe("rental");
    expect(componentTypeForCategory("insurance")).toBe("other");
  });
  it("moveLine renumera el orden", () => {
    const r = moveLine([{ id: "a", order_index: 0 }, { id: "b", order_index: 1 }, { id: "c", order_index: 2 }], 2, 0);
    expect(r.map((x) => `${x.id}${x.order_index}`)).toEqual(["c0", "a1", "b2"]);
  });
  it("último valor cotizado conserva moneda y fecha sin mezclar", () => {
    const m = lastQuotedByPackage([
      { package_template_id: "p", quotation_id: "q1", quotation_number: "1", total_amount: 1000, currency: "ARS", created_at: "2026-01-01", pax_count: 2, nights: 3 },
      { package_template_id: "p", quotation_id: "q2", quotation_number: "2", total_amount: 1850, currency: "USD", created_at: "2026-10-01", pax_count: 2, nights: 5 },
      { package_template_id: null, quotation_id: "q3", quotation_number: "3", total_amount: 9, currency: "USD", created_at: "2027-01-01", pax_count: 1, nights: 1 },
    ]);
    expect(m.get("p")).toMatchObject({ quotation_id: "q2", total_amount: 1850, currency: "USD", created_at: "2026-10-01" });
    expect(m.size).toBe(1);
  });
});
