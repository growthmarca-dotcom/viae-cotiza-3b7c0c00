import { supabase } from "@/integrations/supabase/client";
import {
  formatMoney,
  toAnalysisCurrency,
  type AnalysisCurrency,
} from "@/lib/currency";
import type { TransportService } from "@/lib/transport";

/**
 * Economía y control comercial del transporte (v1.6).
 *
 * Registra el precio vendido al pasajero, el costo del proveedor/conductor y
 * el margen de ViaE. El tipo de cambio se guarda EN EL SERVICIO al momento de
 * cargarlo: nunca se recalcula solo, para que el histórico no cambie.
 *
 * No hay pagos reales, transferencias, liquidación automática ni facturación:
 * sólo estados económicos e indicadores.
 */

export type SettlementStatus = "pending" | "in_review" | "settled";

export const SETTLEMENT_STATUSES: { value: SettlementStatus; label: string }[] = [
  { value: "pending", label: "Liquidación pendiente" },
  { value: "in_review", label: "En revisión" },
  { value: "settled", label: "Liquidado" },
];

export function settlementLabel(value: string | null) {
  if (!value) return "—";
  return SETTLEMENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function settlementClasses(value: string | null) {
  switch (value) {
    case "settled":
      return "bg-primary/10 text-primary border-primary/30";
    case "in_review":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export const ECONOMIC_CURRENCIES = ["ARS", "USD"] as const;
export type EconomicCurrency = (typeof ECONOMIC_CURRENCIES)[number];

// --------------------------------------------------------------- formulario

export type ServiceEconomicsInput = {
  sale_amount: string;
  sale_currency: EconomicCurrency;
  sale_exchange_rate: string;
  sale_rate_date: string;
  cost_amount: string;
  cost_currency: EconomicCurrency;
  cost_exchange_rate: string;
  cost_rate_date: string;
  settlement_status: SettlementStatus;
  settlement_note: string;
};

export const EMPTY_SERVICE_ECONOMICS: ServiceEconomicsInput = {
  sale_amount: "",
  sale_currency: "ARS",
  sale_exchange_rate: "",
  sale_rate_date: "",
  cost_amount: "",
  cost_currency: "ARS",
  cost_exchange_rate: "",
  cost_rate_date: "",
  settlement_status: "pending",
  settlement_note: "",
};

export function economicsToInput(s: TransportService): ServiceEconomicsInput {
  return {
    sale_amount: s.sale_amount != null ? String(s.sale_amount) : "",
    sale_currency: (s.sale_currency === "USD" ? "USD" : "ARS") as EconomicCurrency,
    sale_exchange_rate: s.sale_exchange_rate != null ? String(s.sale_exchange_rate) : "",
    sale_rate_date: s.sale_rate_date ?? "",
    cost_amount: s.cost_amount != null ? String(s.cost_amount) : "",
    cost_currency: (s.cost_currency === "USD" ? "USD" : "ARS") as EconomicCurrency,
    cost_exchange_rate: s.cost_exchange_rate != null ? String(s.cost_exchange_rate) : "",
    cost_rate_date: s.cost_rate_date ?? "",
    settlement_status: (s.settlement_status ?? "pending") as SettlementStatus,
    settlement_note: s.settlement_note ?? "",
  };
}

export function economicsPayload(input: ServiceEconomicsInput) {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const text = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    sale_amount: num(input.sale_amount),
    sale_currency: input.sale_currency,
    sale_exchange_rate: num(input.sale_exchange_rate),
    sale_rate_date: text(input.sale_rate_date),
    cost_amount: num(input.cost_amount),
    cost_currency: input.cost_currency,
    cost_exchange_rate: num(input.cost_exchange_rate),
    cost_rate_date: text(input.cost_rate_date),
    settlement_status: input.settlement_status,
    settlement_note: text(input.settlement_note),
  };
}

/** Guarda la economía del servicio. La auditoría la registra un trigger de la base. */
export async function saveServiceEconomics(id: string, input: ServiceEconomicsInput) {
  const { error } = await supabase
    .from("transport_services")
    .update(economicsPayload(input))
    .eq("id", id);
  if (error) throw error;
}

export async function setSettlementStatus(id: string, status: SettlementStatus) {
  const { error } = await supabase
    .from("transport_services")
    .update({ settlement_status: status })
    .eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------ conversión

export type Converted = {
  amount: number | null;
  currency: string;
  rate: number | null;
  amountArs: number | null;
  amountUsd: number | null;
};

/**
 * Equivalencia ARS ⇄ USD con el tipo de cambio guardado en el servicio.
 * Misma lógica que cotizaciones y reservas: `rate` = ARS por 1 USD.
 */
export function convertAmount(
  amount: number | null | undefined,
  currency: string,
  rate: number | null | undefined,
): Converted {
  const value = amount == null ? null : Number(amount);
  const r = rate != null && Number(rate) > 0 ? Number(rate) : null;
  if (value == null) return { amount: null, currency, rate: r, amountArs: null, amountUsd: null };
  if (currency === "USD") {
    return { amount: value, currency, rate: r, amountUsd: value, amountArs: r ? round2(value * r) : null };
  }
  return { amount: value, currency, rate: r, amountArs: value, amountUsd: r ? round2(value / r) : null };
}

export function formatConverted(c: Converted) {
  if (c.amount == null) return "—";
  const original = formatMoney(c.currency, c.amount);
  const other = c.currency === "USD" ? c.amountArs : c.amountUsd;
  const otherCurrency = c.currency === "USD" ? "ARS" : "USD";
  if (other == null) return `${original} · sin tipo de cambio cargado`;
  return `${original} ≈ ${formatMoney(otherCurrency, other)} (TC ${c.rate})`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// -------------------------------------------------------------- margen

export type ServiceMargin = {
  sale: number | null;
  cost: number | null;
  gross: number | null;
  percent: number | null;
  currency: AnalysisCurrency;
  /** true cuando faltó tipo de cambio y no se pudo convertir algún importe. */
  incomplete: boolean;
};

/** Margen del servicio expresado en la moneda de análisis configurada. */
export function marginOf(s: TransportService, to: AnalysisCurrency): ServiceMargin {
  const sale = toAnalysisCurrency(s.sale_amount, s.sale_currency ?? "ARS", to, s.sale_exchange_rate);
  const cost = toAnalysisCurrency(s.cost_amount, s.cost_currency ?? "ARS", to, s.cost_exchange_rate);
  const hasSale = s.sale_amount != null;
  const hasCost = s.cost_amount != null;
  const gross = hasSale && sale != null ? round2(sale - (cost ?? 0)) : null;
  const percent = gross != null && sale != null && sale > 0 ? round2((gross / sale) * 100) : null;
  return {
    sale: hasSale ? sale : null,
    cost: hasCost ? cost : null,
    gross,
    percent,
    currency: to,
    incomplete: (hasSale && sale == null) || (hasCost && cost == null),
  };
}

// ------------------------------------------------- dashboard económico

export type TransportEconomics = {
  currency: AnalysisCurrency;
  servicesDone: number;
  sales: number;
  costs: number;
  gross: number;
  marginPercent: number | null;
  pendingCollection: number;
  pendingCollectionAmount: number;
  pendingSettlement: number;
  pendingSettlementAmount: number;
  /** Servicios excluidos por falta de tipo de cambio. */
  excluded: number;
};

export function computeTransportEconomics(
  services: TransportService[],
  to: AnalysisCurrency,
): TransportEconomics {
  let sales = 0;
  let costs = 0;
  let excluded = 0;
  let pendingCollection = 0;
  let pendingCollectionAmount = 0;
  let pendingSettlement = 0;
  let pendingSettlementAmount = 0;

  for (const s of services) {
    const m = marginOf(s, to);
    if (m.incomplete) excluded += 1;
    sales += m.sale ?? 0;
    costs += m.cost ?? 0;

    if (s.collection_status === "pending" || s.collection_status === "reported") {
      pendingCollection += 1;
      pendingCollectionAmount +=
        toAnalysisCurrency(
          s.collection_amount,
          s.collection_currency ?? "ARS",
          to,
          s.sale_exchange_rate,
        ) ?? 0;
    }

    if (s.settlement_status !== "settled" && s.cost_amount != null) {
      pendingSettlement += 1;
      pendingSettlementAmount += m.cost ?? 0;
    }
  }

  const gross = round2(sales - costs);
  return {
    currency: to,
    servicesDone: services.filter((s) => s.status === "completed").length,
    sales: round2(sales),
    costs: round2(costs),
    gross,
    marginPercent: sales > 0 ? round2((gross / sales) * 100) : null,
    pendingCollection,
    pendingCollectionAmount: round2(pendingCollectionAmount),
    pendingSettlement,
    pendingSettlementAmount: round2(pendingSettlementAmount),
    excluded,
  };
}
