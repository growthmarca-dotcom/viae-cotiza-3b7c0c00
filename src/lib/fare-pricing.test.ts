import { describe, expect, it } from "vitest";
import {
  calculateFare,
  fareCalculationFields,
  DEFAULT_MERCADO_PAGO_FEE_RATE,
  DEFAULT_NQN_COMMISSION_RATE,
} from "./fare-pricing";

describe("motor de cálculo de cobro NQN Movilidad", () => {
  it("calcula el caso base de 100.000", () => {
    const r = calculateFare({ precioTaxi: 100000 });
    expect(r.nqn_commission_rate).toBe(0.05);
    expect(r.mercado_pago_fee_rate).toBe(0.07986);
    expect(r.nqn_commission_amount).toBe(5000);
    expect(r.importe_neto_objetivo).toBe(105000);
    expect(r.total_pasajero).toBe(114113.07);
  });

  it("escala proporcionalmente", () => {
    expect(calculateFare({ precioTaxi: 500000 }).total_pasajero).toBeCloseTo(570565.17, -1);
    expect(calculateFare({ precioTaxi: 1000000 }).total_pasajero).toBeCloseTo(1141130.34, -1);
  });

  it("el neto acreditado cubre taxi + comisión", () => {
    const r = calculateFare({ precioTaxi: 237500 });
    const neto = r.total_pasajero * (1 - r.mercado_pago_fee_rate);
    expect(neto).toBeCloseTo(r.precio_base_taxi + r.nqn_commission_amount, 2);
  });

  it("permite tasas configurables", () => {
    const r = calculateFare({
      precioTaxi: 100000,
      nqnCommissionRate: 0.1,
      mercadoPagoFeeRate: 0,
    });
    expect(r.nqn_commission_amount).toBe(10000);
    expect(r.total_pasajero).toBe(110000);
  });

  it("expone los campos a persistir", () => {
    const fields = fareCalculationFields(calculateFare({ precioTaxi: 100000 }));
    expect(Object.keys(fields).sort()).toEqual([
      "mercado_pago_fee_rate",
      "nqn_commission_amount",
      "nqn_commission_rate",
      "precio_base_taxi",
      "total_pasajero",
    ]);
  });

  it("valida entradas", () => {
    expect(() => calculateFare({ precioTaxi: -1 })).toThrow();
    expect(() => calculateFare({ precioTaxi: 100, mercadoPagoFeeRate: 1 })).toThrow();
    expect(DEFAULT_NQN_COMMISSION_RATE).toBe(0.05);
    expect(DEFAULT_MERCADO_PAGO_FEE_RATE).toBe(0.07986);
  });
});
