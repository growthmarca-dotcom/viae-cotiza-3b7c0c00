import { describe, expect, it } from "vitest";
import { dailyRates, type RatePeriod } from "./accommodationRates";

const p = (o: Partial<RatePeriod>): RatePeriod => ({
  id: Math.random().toString(), ruleId: "r", name: "T", unitId: null, from: "2030-01-01", to: "2030-01-04",
  currency: "USD", price: 100, minNights: 1, active: true, ...o,
});

describe("dailyRates (calendario)", () => {
  it("marca cada noche del período, incluida la última", () => {
    const m = dailyRates([p({})], null);
    expect([...m.keys()]).toEqual(["2030-01-01", "2030-01-02", "2030-01-03", "2030-01-04"]);
  });
  it("días sin tarifa no tienen precio (nunca 0)", () => {
    expect(dailyRates([p({})], null).get("2030-01-05")).toBeUndefined();
  });
  it("superposición del mismo nivel = conflicto, sin precio", () => {
    const m = dailyRates([p({ price: 100 }), p({ from: "2030-01-03", to: "2030-01-06", price: 120 })], null);
    expect(m.get("2030-01-02")).toMatchObject({ kind: "rate", price: 100 });
    expect(m.get("2030-01-03")).toEqual({ kind: "conflict", level: "general" });
    expect(m.get("2030-01-05")).toMatchObject({ kind: "rate", price: 120 });
  });
  it("la tarifa de la unidad prevalece sobre la general, solo para esa unidad", () => {
    const ps = [p({}), p({ unitId: "u1", from: "2030-01-01", to: "2030-01-02", price: 80 })];
    expect(dailyRates(ps, "u1").get("2030-01-01")).toMatchObject({ price: 80, level: "unit" });
    expect(dailyRates(ps, "u1").get("2030-01-03")).toMatchObject({ price: 100, level: "general" });
    expect(dailyRates(ps, "u2").get("2030-01-01")).toMatchObject({ price: 100 });
    expect(dailyRates(ps, null).get("2030-01-01")).toMatchObject({ price: 100 });
  });
  it("conserva la estadía mínima e ignora inactivas", () => {
    const m = dailyRates([p({ minNights: 3 }), p({ from: "2030-01-10", to: "2030-01-10", active: false })], null);
    expect(m.get("2030-01-01")).toMatchObject({ minNights: 3 });
    expect(m.get("2030-01-10")).toBeUndefined();
  });
});
