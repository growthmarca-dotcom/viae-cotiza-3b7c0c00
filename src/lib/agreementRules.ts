import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Reglas de acuerdo (agreement_rules) — configuración de la FUENTE OFICIAL del
 * cálculo de comisiones: `commercial_agreements` + `agreement_rules`.
 *
 * Esta capa SOLO configura datos. El cálculo sigue siendo responsabilidad
 * exclusiva de `resolve_agreement(...)` y `compute_commission(...)` en la base.
 * Los campos `agents.commission_*` NO participan del cálculo.
 */

export type AgreementRule = Tables<"agreement_rules">;

export type RuleScope = "all" | "booking" | "booking_service" | "transport_service" | "quotation";
export type RuleBase = "gross" | "net" | "cost" | "margin";
export type RuleCalcType = "percentage" | "fixed";
export type RuleStatus = "active" | "inactive" | "suspended" | "archived";
export type ServiceKind =
  | "accommodation"
  | "transfer"
  | "excursion"
  | "car_rental"
  | "flight"
  | "insurance"
  | "gastronomy"
  | "other";

export const RULE_SCOPES: { value: RuleScope; label: string }[] = [
  { value: "all", label: "Todos los ámbitos" },
  { value: "booking", label: "Reserva" },
  { value: "booking_service", label: "Servicio de reserva" },
  { value: "transport_service", label: "Servicio de transporte" },
  { value: "quotation", label: "Cotización" },
];

export const RULE_BASES: { value: RuleBase; label: string }[] = [
  { value: "gross", label: "Sobre bruto" },
  { value: "net", label: "Sobre neto" },
  { value: "cost", label: "Sobre costo" },
  { value: "margin", label: "Sobre margen" },
];

export const RULE_CALC_TYPES: { value: RuleCalcType; label: string }[] = [
  { value: "percentage", label: "Porcentaje" },
  { value: "fixed", label: "Importe fijo" },
];

export const RULE_STATUSES: { value: RuleStatus; label: string }[] = [
  { value: "active", label: "Activa" },
  { value: "inactive", label: "Inactiva" },
  { value: "suspended", label: "Suspendida" },
  { value: "archived", label: "Archivada" },
];

export const SERVICE_KINDS: { value: ServiceKind | ""; label: string }[] = [
  { value: "", label: "Cualquier tipo de servicio" },
  { value: "accommodation", label: "Alojamiento" },
  { value: "transfer", label: "Traslado" },
  { value: "excursion", label: "Excursión" },
  { value: "car_rental", label: "Alquiler de auto" },
  { value: "flight", label: "Aéreo" },
  { value: "insurance", label: "Asistencia / seguro" },
  { value: "gastronomy", label: "Gastronomía" },
  { value: "other", label: "Otro" },
];

export const RULE_CURRENCIES = ["ARS", "USD"];

export function ruleScopeLabel(v: string | null | undefined) {
  return RULE_SCOPES.find((s) => s.value === v)?.label ?? "—";
}
export function ruleBaseLabel(v: string | null | undefined) {
  return RULE_BASES.find((s) => s.value === v)?.label ?? "—";
}
export function ruleStatusLabel(v: string | null | undefined) {
  return RULE_STATUSES.find((s) => s.value === v)?.label ?? "—";
}
export function serviceKindLabel(v: string | null | undefined) {
  return SERVICE_KINDS.find((s) => s.value === (v ?? ""))?.label ?? "—";
}

export function ruleValueLabel(r: AgreementRule) {
  return r.calc_type === "percentage"
    ? `${Number(r.value)}%`
    : `${r.currency} ${Number(r.value).toLocaleString("es-AR")}`;
}

export const RULE_STATUS_CLASSES: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  inactive: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/10 text-destructive",
  archived: "bg-secondary text-muted-foreground",
};

export type AgreementRuleInput = {
  label: string;
  scope: RuleScope;
  service_kind: ServiceKind | "";
  base: RuleBase;
  calc_type: RuleCalcType;
  value: string;
  currency: string;
  min_amount: string;
  max_amount: string;
  excludes_taxes: boolean;
  excludes_extras: boolean;
  valid_from: string;
  valid_until: string;
  priority: string;
  status: RuleStatus;
  notes: string;
};

export const EMPTY_AGREEMENT_RULE: AgreementRuleInput = {
  label: "",
  scope: "all",
  service_kind: "",
  base: "gross",
  calc_type: "percentage",
  value: "",
  currency: "ARS",
  min_amount: "",
  max_amount: "",
  excludes_taxes: true,
  excludes_extras: false,
  valid_from: "",
  valid_until: "",
  priority: "100",
  status: "active",
  notes: "",
};

export function ruleToInput(r: AgreementRule): AgreementRuleInput {
  return {
    label: r.label ?? "",
    scope: (r.scope ?? "all") as RuleScope,
    service_kind: (r.service_kind ?? "") as ServiceKind | "",
    base: (r.base ?? "gross") as RuleBase,
    calc_type: (r.calc_type ?? "percentage") as RuleCalcType,
    value: r.value != null ? String(r.value) : "",
    currency: r.currency ?? "ARS",
    min_amount: r.min_amount != null ? String(r.min_amount) : "",
    max_amount: r.max_amount != null ? String(r.max_amount) : "",
    excludes_taxes: r.excludes_taxes ?? true,
    excludes_extras: r.excludes_extras ?? false,
    valid_from: r.valid_from ?? "",
    valid_until: r.valid_until ?? "",
    priority: r.priority != null ? String(r.priority) : "100",
    status: (r.status ?? "active") as RuleStatus,
    notes: r.notes ?? "",
  };
}

const num = (v: string) => (v.trim() ? Number(v) : null);
const text = (v: string) => (v.trim() ? v.trim() : null);

/** Validaciones alineadas al esquema: no se inventan reglas de negocio nuevas. */
export function validateAgreementRule(input: AgreementRuleInput): string | null {
  const value = Number(input.value);
  if (!input.value.trim() || !Number.isFinite(value))
    return "Indicá el valor de la regla (porcentaje o importe).";
  if (value < 0) return "El valor de la regla no puede ser negativo.";
  if (input.calc_type === "percentage" && value > 100)
    return "Un porcentaje no puede superar 100%.";
  if (input.calc_type === "fixed" && !input.currency)
    return "Una regla de importe fijo necesita moneda.";

  const min = num(input.min_amount);
  const max = num(input.max_amount);
  if (min != null && (!Number.isFinite(min) || min < 0))
    return "El importe mínimo no es válido.";
  if (max != null && (!Number.isFinite(max) || max < 0))
    return "El importe máximo no es válido.";
  if (min != null && max != null && max < min)
    return "El importe máximo no puede ser menor que el mínimo.";

  const priority = Number(input.priority);
  if (!Number.isInteger(priority) || priority < 0)
    return "La prioridad debe ser un número entero mayor o igual a cero.";

  if (input.valid_from && input.valid_until && input.valid_until < input.valid_from)
    return "La fecha de fin no puede ser anterior a la de inicio.";

  return null;
}

function payload(input: AgreementRuleInput) {
  return {
    label: text(input.label),
    scope: input.scope,
    service_kind: input.service_kind || null,
    base: input.base,
    calc_type: input.calc_type,
    value: Number(input.value),
    currency: input.currency,
    min_amount: num(input.min_amount),
    max_amount: num(input.max_amount),
    excludes_taxes: input.excludes_taxes,
    excludes_extras: input.excludes_extras,
    valid_from: text(input.valid_from),
    valid_until: text(input.valid_until),
    priority: Number(input.priority),
    status: input.status,
    notes: text(input.notes),
  };
}

// ------------------------------------------------------------ consultas

export async function listAgreementRules(agreementId: string): Promise<AgreementRule[]> {
  const { data, error } = await supabase
    .from("agreement_rules")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("priority")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createAgreementRule(agreementId: string, input: AgreementRuleInput) {
  if (!agreementId) throw new Error("La regla necesita un acuerdo asociado.");
  const invalid = validateAgreementRule(input);
  if (invalid) throw new Error(invalid);

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");

  const { error } = await supabase
    .from("agreement_rules")
    .insert({ ...payload(input), agreement_id: agreementId, user_id: uid });
  if (error) throw error;
}

export async function updateAgreementRule(id: string, input: AgreementRuleInput) {
  const invalid = validateAgreementRule(input);
  if (invalid) throw new Error(invalid);
  const { error } = await supabase.from("agreement_rules").update(payload(input)).eq("id", id);
  if (error) throw error;
}

/** Las reglas no se eliminan desde la UI: cambian de estado (historial intacto). */
export async function setAgreementRuleStatus(id: string, status: RuleStatus) {
  const { error } = await supabase.from("agreement_rules").update({ status }).eq("id", id);
  if (error) throw error;
}
