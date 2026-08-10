/**
 * Motor de cálculo de cobro — NQN Movilidad.
 *
 * Lógica AISLADA y reutilizable: solo calcula el precio final del viaje.
 * No integra Mercado Pago, no crea preferencias, no ejecuta pagos y no
 * toca el flujo financiero existente (Financial Core / money.ts).
 *
 * Modelo:
 *  - el taxi define un precio NETO que debe recibir (precio_base_taxi);
 *  - NQN Movilidad cobra una comisión configurable sobre ese precio;
 *  - el costo estimado de Mercado Pago se traslada al pasajero por
 *    TASA INVERSA, de modo que el neto acreditado cubra taxi + comisión.
 */

/** Comisión de NQN Movilidad por defecto (5%). */
export const DEFAULT_NQN_COMMISSION_RATE = 0.05;

/** Costo estimado de Mercado Pago por defecto (7.986%). */
export const DEFAULT_MERCADO_PAGO_FEE_RATE = 0.07986;

export type FareCalculationInput = {
  /** Precio neto que debe recibir el taxi. */
  precioTaxi: number;
  /** Comisión de NQN Movilidad (0.05 = 5%). */
  nqnCommissionRate?: number;
  /** Costo estimado de Mercado Pago (0.07986 = 7.986%). */
  mercadoPagoFeeRate?: number;
};

export type FareCalculation = {
  precio_base_taxi: number;
  nqn_commission_rate: number;
  nqn_commission_amount: number;
  mercado_pago_fee_rate: number;
  /** Neto que debe quedar disponible: taxi + comisión NQN. */
  importe_neto_objetivo: number;
  /** Importe total que paga el pasajero (incluye el costo de MP). */
  total_pasajero: number;
  /** Costo estimado de Mercado Pago trasladado al pasajero. */
  mercado_pago_fee_amount: number;
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el precio final del viaje.
 *
 * total_pasajero = (precio_taxi + comisión NQN) / (1 - tasa MP)
 */
export function calculateFare({
  precioTaxi,
  nqnCommissionRate = DEFAULT_NQN_COMMISSION_RATE,
  mercadoPagoFeeRate = DEFAULT_MERCADO_PAGO_FEE_RATE,
}: FareCalculationInput): FareCalculation {
  if (!Number.isFinite(precioTaxi) || precioTaxi < 0) {
    throw new Error("El precio del taxi debe ser un número positivo");
  }
  if (nqnCommissionRate < 0 || nqnCommissionRate >= 1) {
    throw new Error("La comisión de NQN debe estar entre 0 y 1");
  }
  if (mercadoPagoFeeRate < 0 || mercadoPagoFeeRate >= 1) {
    throw new Error("La tasa de Mercado Pago debe estar entre 0 y 1");
  }

  const nqnCommissionAmount = round2(precioTaxi * nqnCommissionRate);
  const netTarget = round2(precioTaxi + nqnCommissionAmount);
  const totalPassenger = round2(netTarget / (1 - mercadoPagoFeeRate));

  return {
    precio_base_taxi: round2(precioTaxi),
    nqn_commission_rate: nqnCommissionRate,
    nqn_commission_amount: nqnCommissionAmount,
    mercado_pago_fee_rate: mercadoPagoFeeRate,
    importe_neto_objetivo: netTarget,
    total_pasajero: totalPassenger,
    mercado_pago_fee_amount: round2(totalPassenger - netTarget),
  };
}

/**
 * Campos listos para persistir en la cotización o reserva.
 * (La persistencia real se implementa en una fase posterior.)
 */
export function fareCalculationFields(calc: FareCalculation) {
  return {
    precio_base_taxi: calc.precio_base_taxi,
    nqn_commission_rate: calc.nqn_commission_rate,
    nqn_commission_amount: calc.nqn_commission_amount,
    mercado_pago_fee_rate: calc.mercado_pago_fee_rate,
    total_pasajero: calc.total_pasajero,
  };
}
