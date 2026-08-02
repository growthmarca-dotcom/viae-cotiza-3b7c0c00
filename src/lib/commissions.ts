import { supabase } from "@/integrations/supabase/client";

/**
 * Motor de comisiones — v1.9.4 Fase A (SIMULACIÓN).
 *
 * Esta capa es de SOLO LECTURA: llama a `simulate_commission` /
 * `simulate_commission_transport`, que resuelven el acuerdo y la regla que
 * aplicarían y calculan el importe, sin insertar nada en `commissions`.
 *
 * No hay devengo, liquidaciones ni pagos todavía. La tabla `commissions`
 * existe vacía y `commission_history` queda preparada para el futuro
 * (intencionalmente separada de `agreement_history`).
 *
 * Visibilidad: administrador ve todo; operaciones ve la simulación sin costos
 * ni márgenes; agente ve un resumen de lo propio; proveedor sin acceso.
 * El recorte lo hace la función en la base, no el cliente.
 */

export type CommissionBase = "gross" | "net" | "cost" | "margin";
export type CommissionCalcType = "percentage" | "fixed";

export type CommissionSimulation = {
  found: boolean;
  has_agreement?: boolean;
  simulation?: boolean;
  booking_service_id?: string;
  transport_service_id?: string;
  booking_id?: string | null;
  service_kind?: string | null;
  agreement_id?: string | null;
  agreement_version?: number | null;
  agreement_title?: string | null;
  rule_id?: string | null;
  rule_label?: string | null;
  base?: CommissionBase;
  calc_type?: CommissionCalcType;
  calc_value?: number | null;
  excludes_taxes?: boolean;
  excludes_extras?: boolean;
  currency?: string;
  sale_currency?: string;
  gross_sale_amount?: number | null;
  taxes_amount?: number | null;
  extras_amount?: number | null;
  discount_amount?: number | null;
  cost_amount?: number | null;
  base_amount?: number | null;
  commission_amount?: number | null;
  warnings?: string[];
  score?: number;
  restricted?: boolean;
  summary_only?: boolean;
};

export const BASE_LABELS: Record<CommissionBase, string> = {
  gross: "Sobre bruto",
  net: "Sobre neto",
  cost: "Sobre costo",
  margin: "Sobre margen",
};

export function baseLabel(v: string | null | undefined) {
  return BASE_LABELS[(v ?? "") as CommissionBase] ?? "—";
}

export function calcLabel(sim: CommissionSimulation) {
  if (sim.calc_value == null) return "—";
  return sim.calc_type === "percentage"
    ? `${sim.calc_value}%`
    : `${sim.currency ?? "ARS"} ${Number(sim.calc_value).toLocaleString("es-AR")}`;
}

/** Simulación de la comisión de un servicio de reserva. No escribe nada. */
export async function simulateCommission(bookingServiceId: string): Promise<CommissionSimulation> {
  const { data, error } = await supabase.rpc("simulate_commission", {
    _booking_service_id: bookingServiceId,
  });
  if (error) throw error;
  return (data ?? { found: false }) as unknown as CommissionSimulation;
}

/**
 * Simulación para transporte: preparada como lectura. No modifica
 * `transport_services` ni la economía existente del módulo.
 */
export async function simulateTransportCommission(
  transportServiceId: string,
): Promise<CommissionSimulation> {
  const { data, error } = await supabase.rpc("simulate_commission_transport", {
    _transport_service_id: transportServiceId,
  });
  if (error) throw error;
  return (data ?? { found: false }) as unknown as CommissionSimulation;
}

/**
 * Totales de simulación agrupados POR MONEDA.
 * Nunca se suman monedas distintas en un único total; la moneda de análisis
 * se maneja aparte, en los tableros que la usan.
 */
export type CommissionTotals = {
  byCurrency: { currency: string; commission: number; count: number }[];
  withoutAgreement: number;
  withWarnings: number;
};

export function computeSimulationTotals(rows: CommissionSimulation[]): CommissionTotals {
  const map = new Map<string, { commission: number; count: number }>();
  let withoutAgreement = 0;
  let withWarnings = 0;

  for (const r of rows) {
    if (!r.has_agreement) withoutAgreement += 1;
    if ((r.warnings?.length ?? 0) > 0) withWarnings += 1;
    if (r.commission_amount == null) continue;
    const currency = r.currency ?? "ARS";
    const acc = map.get(currency) ?? { commission: 0, count: 0 };
    acc.commission = Math.round((acc.commission + Number(r.commission_amount)) * 100) / 100;
    acc.count += 1;
    map.set(currency, acc);
  }

  return {
    byCurrency: [...map.entries()]
      .map(([currency, v]) => ({ currency, ...v }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    withoutAgreement,
    withWarnings,
  };
}
