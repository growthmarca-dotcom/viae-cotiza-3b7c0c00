import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Módulo de Proveedores (v1.9).
 * Centraliza empresas y prestadores independientes que trabajan con ViaE.
 * Los recursos, servicios de transporte y servicios de reserva pueden
 * vincularse a un proveedor. No incluye integraciones externas todavía.
 */

export type Provider = Tables<"providers">;
export type ProviderEvaluation = Tables<"provider_evaluations">;

export type ProviderType =
  | "wholesaler"
  | "hotel"
  | "car_rental"
  | "transport_company"
  | "excursion_operator"
  | "independent_guide"
  | "gastronomy"
  | "nautical"
  | "air"
  | "ground"
  | "other";

export type ProviderStatus = "active" | "inactive" | "suspended" | "archived";

export type ProviderOperationMode =
  | "manual"
  | "viae_portal"
  | "api"
  | "webhook"
  | "email"
  | "whatsapp"
  | "other";

export const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: "wholesaler", label: "Mayorista" },
  { value: "hotel", label: "Hotel" },
  { value: "car_rental", label: "Rentadora" },
  { value: "transport_company", label: "Empresa de transporte" },
  { value: "excursion_operator", label: "Prestador de excursiones" },
  { value: "independent_guide", label: "Guía independiente" },
  { value: "gastronomy", label: "Proveedor gastronómico" },
  { value: "nautical", label: "Proveedor náutico" },
  { value: "air", label: "Proveedor aéreo" },
  { value: "ground", label: "Proveedor terrestre" },
  { value: "other", label: "Otro" },
];

export const PROVIDER_STATUSES: { value: ProviderStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "suspended", label: "Suspendido" },
  { value: "archived", label: "Archivado" },
];

export const PROVIDER_OPERATION_MODES: { value: ProviderOperationMode; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "viae_portal", label: "Portal ViaE" },
  { value: "api", label: "API REST" },
  { value: "webhook", label: "Webhook" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Otro" },
];

export const TAX_CONDITIONS = [
  "Responsable Inscripto",
  "Monotributista",
  "Exento",
  "Consumidor Final",
  "No aplica / Exterior",
];

export function providerTypeLabel(v: string | null) {
  return PROVIDER_TYPES.find((t) => t.value === v)?.label ?? "Otro";
}
export function providerStatusLabel(v: string | null) {
  return PROVIDER_STATUSES.find((t) => t.value === v)?.label ?? "—";
}
export function providerModeLabel(v: string | null) {
  return PROVIDER_OPERATION_MODES.find((t) => t.value === v)?.label ?? "Manual";
}

export type ProviderInput = {
  trade_name: string;
  legal_name: string;
  tax_id: string;
  tax_condition: string;
  provider_type: ProviderType;
  operation_mode: ProviderOperationMode;
  is_company: boolean;
  website: string;
  email: string;
  whatsapp: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  contact_name: string;
  notes: string;
  status: ProviderStatus;
};

export const EMPTY_PROVIDER: ProviderInput = {
  trade_name: "",
  legal_name: "",
  tax_id: "",
  tax_condition: "",
  provider_type: "other",
  operation_mode: "manual",
  is_company: true,
  website: "",
  email: "",
  whatsapp: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "Argentina",
  contact_name: "",
  notes: "",
  status: "active",
};

const text = (v: string) => (v.trim() ? v.trim() : null);

export function providerToInput(p: Provider): ProviderInput {
  return {
    trade_name: p.trade_name ?? "",
    legal_name: p.legal_name ?? "",
    tax_id: p.tax_id ?? "",
    tax_condition: p.tax_condition ?? "",
    provider_type: (p.provider_type ?? "other") as ProviderType,
    operation_mode: (p.operation_mode ?? "manual") as ProviderOperationMode,
    is_company: p.is_company ?? true,
    website: p.website ?? "",
    email: p.email ?? "",
    whatsapp: p.whatsapp ?? "",
    phone: p.phone ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    country: p.country ?? "",
    contact_name: p.contact_name ?? "",
    notes: p.notes ?? "",
    status: (p.status ?? "active") as ProviderStatus,
  };
}

function payload(input: ProviderInput) {
  return {
    trade_name: input.trade_name.trim(),
    legal_name: text(input.legal_name),
    tax_id: text(input.tax_id),
    tax_condition: text(input.tax_condition),
    provider_type: input.provider_type,
    operation_mode: input.operation_mode,
    is_company: input.is_company,
    website: text(input.website),
    email: text(input.email),
    whatsapp: text(input.whatsapp),
    phone: text(input.phone),
    address: text(input.address),
    city: text(input.city),
    state: text(input.state),
    country: text(input.country),
    contact_name: text(input.contact_name),
    notes: text(input.notes),
    status: input.status,
  };
}

export type ProviderFilters = {
  search?: string;
  type?: ProviderType | "all";
  status?: ProviderStatus | "all";
  state?: string;
  country?: string;
  includeArchived?: boolean;
};

export async function listProviders(filters: ProviderFilters = {}): Promise<Provider[]> {
  let q = supabase.from("providers").select("*").order("trade_name", { ascending: true });
  if (filters.type && filters.type !== "all") q = q.eq("provider_type", filters.type);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  else if (!filters.includeArchived) q = q.neq("status", "archived");
  if (filters.state && filters.state !== "all") q = q.eq("state", filters.state);
  if (filters.country && filters.country !== "all") q = q.eq("country", filters.country);

  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as Provider[];

  const s = filters.search?.trim().toLowerCase();
  if (s) {
    rows = rows.filter((r) =>
      [r.trade_name, r.legal_name, r.tax_id, r.email, r.whatsapp, r.phone, r.city, r.state, r.contact_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }
  return rows;
}

export async function getProvider(id: string): Promise<Provider | null> {
  const { data, error } = await supabase.from("providers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Provider) ?? null;
}

export async function createProvider(input: ProviderInput): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { data, error } = await supabase
    .from("providers")
    .insert({ ...payload(input), user_id: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateProvider(id: string, input: ProviderInput) {
  const { error } = await supabase.from("providers").update(payload(input)).eq("id", id);
  if (error) throw error;
}

/** Los proveedores nunca se eliminan: cambian de estado. */
export async function setProviderStatus(id: string, status: ProviderStatus) {
  const { error } = await supabase.from("providers").update({ status }).eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------- evaluaciones

export type EvaluationInput = {
  quality: number;
  punctuality: number;
  response_time: number;
  compliance: number;
  internal_rating: number;
  notes: string;
};

export const EMPTY_EVALUATION: EvaluationInput = {
  quality: 3,
  punctuality: 3,
  response_time: 3,
  compliance: 3,
  internal_rating: 3,
  notes: "",
};

export async function listEvaluations(providerId: string): Promise<ProviderEvaluation[]> {
  const { data, error } = await supabase
    .from("provider_evaluations")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProviderEvaluation[];
}

export async function createEvaluation(providerId: string, input: EvaluationInput) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { error } = await supabase.from("provider_evaluations").insert({
    provider_id: providerId,
    user_id: uid,
    quality: input.quality,
    punctuality: input.punctuality,
    response_time: input.response_time,
    compliance: input.compliance,
    internal_rating: input.internal_rating,
    notes: input.notes.trim() || null,
  });
  if (error) throw error;
}

export function averageRating(rows: ProviderEvaluation[]): number | null {
  if (!rows.length) return null;
  const total = rows.reduce(
    (acc, r) => acc + (r.quality + r.punctuality + r.response_time + r.compliance + r.internal_rating) / 5,
    0,
  );
  return Math.round((total / rows.length) * 10) / 10;
}

// --------------------------------------------------------- panel del proveedor

export type ProviderPanel = {
  resources: Tables<"resources">[];
  transportServices: Tables<"transport_services">[];
  bookingServices: Tables<"booking_services">[];
  bookings: Tables<"bookings">[];
  incidents: number;
  servicesDone: number;
  servicesPending: number;
  soldAmount: number;
  boughtAmount: number;
};

const DONE = new Set(["completed", "finished"]);
const CLOSED = new Set(["completed", "finished", "cancelled", "rejected"]);

/** Datos operativos y económicos agregados de un proveedor. */
export async function getProviderPanel(providerId: string): Promise<ProviderPanel> {
  const [{ data: resources }, { data: transport }, { data: bookingServices }] = await Promise.all([
    supabase.from("resources").select("*").eq("provider_id", providerId),
    supabase.from("transport_services").select("*").eq("provider_id", providerId),
    supabase.from("booking_services").select("*").eq("provider_id", providerId),
  ]);

  const res = (resources ?? []) as Tables<"resources">[];
  const ts = (transport ?? []) as Tables<"transport_services">[];
  const bs = (bookingServices ?? []) as Tables<"booking_services">[];

  const bookingIds = Array.from(
    new Set([...ts.map((s) => s.booking_id), ...bs.map((s) => s.booking_id)].filter(Boolean)),
  ) as string[];

  let bookings: Tables<"bookings">[] = [];
  let incidents = 0;
  if (bookingIds.length) {
    const [{ data: bk }, { count }] = await Promise.all([
      supabase.from("bookings").select("*").in("id", bookingIds),
      supabase
        .from("booking_incidents")
        .select("id", { count: "exact", head: true })
        .in("booking_id", bookingIds),
    ]);
    bookings = (bk ?? []) as Tables<"bookings">[];
    incidents = count ?? 0;
  }

  const servicesDone =
    ts.filter((s) => DONE.has(String(s.status))).length +
    bs.filter((s) => DONE.has(String(s.status))).length;
  const servicesPending =
    ts.filter((s) => !CLOSED.has(String(s.status))).length +
    bs.filter((s) => !CLOSED.has(String(s.status))).length;

  const soldAmount = ts.reduce((a, s) => a + Number(s.sale_amount ?? s.amount ?? 0), 0);
  const boughtAmount = ts.reduce((a, s) => a + Number(s.cost_amount ?? 0), 0);

  return {
    resources: res,
    transportServices: ts,
    bookingServices: bs,
    bookings,
    incidents,
    servicesDone,
    servicesPending,
    soldAmount,
    boughtAmount,
  };
}

// ----------------------------------------------------------------- métricas

export type ProviderStats = {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  archived: number;
  byType: { label: string; count: number }[];
  byState: { label: string; count: number }[];
  byCountry: { label: string; count: number }[];
};

function group(rows: Provider[], key: (p: Provider) => string | null) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeProviderStats(rows: Provider[]): ProviderStats {
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    inactive: rows.filter((r) => r.status === "inactive").length,
    suspended: rows.filter((r) => r.status === "suspended").length,
    archived: rows.filter((r) => r.status === "archived").length,
    byType: group(rows, (p) => providerTypeLabel(p.provider_type)),
    byState: group(rows, (p) => p.state),
    byCountry: group(rows, (p) => p.country),
  };
}

/** Totales de servicios asociados a proveedores (para el dashboard). */
export async function providerServiceTotals(): Promise<{ done: number; pending: number }> {
  const { data } = await supabase
    .from("transport_services")
    .select("status, provider_id")
    .not("provider_id", "is", null);
  const rows = data ?? [];
  return {
    done: rows.filter((r) => DONE.has(String(r.status))).length,
    pending: rows.filter((r) => !CLOSED.has(String(r.status))).length,
  };
}
