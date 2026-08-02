import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Acuerdos comerciales (v1.9.2).
 *
 * Centraliza las condiciones comerciales de ViaE con organizaciones
 * (proveedores, agencias asociadas, operadores, partners) y con agentes
 * comerciales. La estructura es intencionalmente simple y flexible: todavía
 * no hay motor de reglas, sólo el registro de condiciones vigentes.
 */

export type CommercialAgreement = Tables<"commercial_agreements">;

export type AgreementType =
  | "commission_percentage"
  | "fixed_commission"
  | "net_rate"
  | "service_fee"
  | "custom";

export type AgreementStatus = "draft" | "active" | "expired" | "suspended" | "archived";

export type CommissionType = "percentage" | "fixed";

export const AGREEMENT_TYPES: { value: AgreementType; label: string; help: string }[] = [
  {
    value: "commission_percentage",
    label: "Comisión porcentual",
    help: "ViaE percibe un porcentaje sobre el valor del servicio.",
  },
  {
    value: "fixed_commission",
    label: "Comisión fija",
    help: "Importe fijo por servicio u operación.",
  },
  { value: "net_rate", label: "Tarifa neta", help: "El proveedor entrega tarifa neta a ViaE." },
  { value: "service_fee", label: "Cargo por servicio", help: "Fee administrativo por gestión." },
  { value: "custom", label: "Personalizado", help: "Condiciones descritas en las notas." },
];

export const AGREEMENT_STATUSES: { value: AgreementStatus; label: string }[] = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Vigente" },
  { value: "expired", label: "Vencido" },
  { value: "suspended", label: "Suspendido" },
  { value: "archived", label: "Archivado" },
];

export const AGREEMENT_CURRENCIES = ["ARS", "USD"];

export function agreementTypeLabel(v: string | null | undefined) {
  return AGREEMENT_TYPES.find((t) => t.value === v)?.label ?? "—";
}
export function agreementStatusLabel(v: string | null | undefined) {
  return AGREEMENT_STATUSES.find((s) => s.value === v)?.label ?? "—";
}

export const AGREEMENT_STATUS_CLASSES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/10 text-primary",
  expired: "bg-secondary text-muted-foreground",
  suspended: "bg-destructive/10 text-destructive",
  archived: "bg-secondary text-muted-foreground",
};

export type AgreementInput = {
  title: string;
  organization_id: string;
  agent_id: string;
  agreement_type: AgreementType;
  commission_type: CommissionType | "";
  commission_value: string;
  currency: string;
  valid_from: string;
  valid_until: string;
  status: AgreementStatus;
  notes: string;
};

export const EMPTY_AGREEMENT: AgreementInput = {
  title: "",
  organization_id: "",
  agent_id: "",
  agreement_type: "commission_percentage",
  commission_type: "percentage",
  commission_value: "",
  currency: "ARS",
  valid_from: "",
  valid_until: "",
  status: "draft",
  notes: "",
};

const text = (v: string) => (v.trim() ? v.trim() : null);

export function agreementToInput(a: CommercialAgreement): AgreementInput {
  return {
    title: a.title ?? "",
    organization_id: a.organization_id ?? "",
    agent_id: a.agent_id ?? "",
    agreement_type: (a.agreement_type ?? "commission_percentage") as AgreementType,
    commission_type: (a.commission_type ?? "") as CommissionType | "",
    commission_value: a.commission_value != null ? String(a.commission_value) : "",
    currency: a.currency ?? "ARS",
    valid_from: a.valid_from ?? "",
    valid_until: a.valid_until ?? "",
    status: (a.status ?? "draft") as AgreementStatus,
    notes: a.notes ?? "",
  };
}

export function validateAgreement(input: AgreementInput): string | null {
  if (!input.organization_id && !input.agent_id)
    return "Seleccioná una organización o un agente para el acuerdo.";
  if (input.commission_value.trim()) {
    const n = Number(input.commission_value);
    if (!Number.isFinite(n) || n < 0) return "El valor de la comisión no es válido.";
    if (input.commission_type === "percentage" && n > 100)
      return "Una comisión porcentual no puede superar 100%.";
  }
  if (input.valid_from && input.valid_until && input.valid_until < input.valid_from)
    return "La fecha de fin no puede ser anterior a la de inicio.";
  return null;
}

function payload(input: AgreementInput) {
  return {
    title: text(input.title),
    organization_id: input.organization_id || null,
    agent_id: input.agent_id || null,
    agreement_type: input.agreement_type,
    commission_type: input.commission_type || null,
    commission_value: input.commission_value.trim() ? Number(input.commission_value) : null,
    currency: input.currency,
    valid_from: text(input.valid_from),
    valid_until: text(input.valid_until),
    status: input.status,
    notes: text(input.notes),
  };
}

/** Formato legible de la condición económica del acuerdo. */
export function agreementValueLabel(a: CommercialAgreement) {
  if (a.commission_value == null) return "Sin valor definido";
  if (a.commission_type === "percentage") return `${a.commission_value}%`;
  return `${a.currency} ${Number(a.commission_value).toLocaleString("es-AR")}`;
}

/** Un acuerdo está vigente si su estado es activo y la fecha actual está en rango. */
export function isAgreementCurrent(a: CommercialAgreement, today = new Date()) {
  if (a.status !== "active") return false;
  const d = today.toISOString().slice(0, 10);
  if (a.valid_from && a.valid_from > d) return false;
  if (a.valid_until && a.valid_until < d) return false;
  return true;
}

// ------------------------------------------------------------ consultas

export type AgreementFilters = {
  organizationId?: string;
  agentId?: string;
  type?: AgreementType | "all";
  status?: AgreementStatus | "all";
  includeArchived?: boolean;
};

export type AgreementWithRelations = CommercialAgreement & {
  organization: { id: string; trade_name: string } | null;
  agent: { id: string; first_name: string; last_name: string | null } | null;
};

export async function listAgreements(
  filters: AgreementFilters = {},
): Promise<AgreementWithRelations[]> {
  let query = supabase
    .from("commercial_agreements")
    .select(
      "*, organization:organizations(id, trade_name), agent:agents(id, first_name, last_name)",
    )
    .order("created_at", { ascending: false });

  if (filters.organizationId) query = query.eq("organization_id", filters.organizationId);
  if (filters.agentId) query = query.eq("agent_id", filters.agentId);
  if (filters.type && filters.type !== "all") query = query.eq("agreement_type", filters.type);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  else if (!filters.includeArchived) query = query.neq("status", "archived");

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AgreementWithRelations[];
}

export async function createAgreement(input: AgreementInput): Promise<string> {
  const invalid = validateAgreement(input);
  if (invalid) throw new Error(invalid);

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");

  const { data, error } = await supabase
    .from("commercial_agreements")
    .insert({ ...payload(input), user_id: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateAgreement(id: string, input: AgreementInput) {
  const invalid = validateAgreement(input);
  if (invalid) throw new Error(invalid);
  const { error } = await supabase.from("commercial_agreements").update(payload(input)).eq("id", id);
  if (error) throw error;
}

/** Los acuerdos no se eliminan: cambian de estado. */
export async function setAgreementStatus(id: string, status: AgreementStatus) {
  const { error } = await supabase.from("commercial_agreements").update({ status }).eq("id", id);
  if (error) throw error;
}

export function computeAgreementStats(rows: CommercialAgreement[]) {
  return {
    total: rows.length,
    current: rows.filter((a) => isAgreementCurrent(a)).length,
    drafts: rows.filter((a) => a.status === "draft").length,
    withAgents: rows.filter((a) => a.agent_id).length,
    withOrganizations: rows.filter((a) => a.organization_id).length,
  };
}
