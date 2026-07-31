import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { LeadSource } from "@/lib/opportunities";
import type { Agent } from "@/lib/agents";

/**
 * Módulo de Leads (v1.7).
 *
 * Cadena comercial: Consulta → Lead → Agente → Cotización → Venta.
 * El historial (`lead_history`) y las notificaciones las generan triggers de
 * la base, por lo que cualquier cambio hecho desde la app queda auditado.
 */

export type Lead = Tables<"leads">;
export type LeadHistory = Tables<"lead_history">;

export type LeadStatus =
  | "new"
  | "unassigned"
  | "assigned"
  | "contacted"
  | "quoted"
  | "following_up"
  | "won"
  | "lost";

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "Nuevo" },
  { value: "unassigned", label: "Sin asignar" },
  { value: "assigned", label: "Asignado" },
  { value: "contacted", label: "Contactado" },
  { value: "quoted", label: "Cotización enviada" },
  { value: "following_up", label: "En seguimiento" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
];

export const LEAD_LANGUAGES = [
  "Español",
  "Inglés",
  "Portugués",
  "Francés",
  "Italiano",
  "Alemán",
  "Otro",
] as const;

export function leadStatusLabel(value: string) {
  return LEAD_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function leadStatusClasses(value: string) {
  switch (value) {
    case "won":
      return "bg-primary/10 text-primary border-primary/30";
    case "lost":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "quoted":
    case "following_up":
      return "bg-gold/15 text-foreground border-gold/40";
    case "unassigned":
    case "new":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function leadFullName(l: Pick<Lead, "first_name" | "last_name">) {
  return [l.first_name, l.last_name].filter(Boolean).join(" ").trim() || "Sin nombre";
}

/* ------------------------------------------------------------------ */
/* Necesidad del viaje (v1.7.1)                                        */
/* ------------------------------------------------------------------ */

export type TripType =
  | "vacation"
  | "family"
  | "adventure"
  | "honeymoon"
  | "corporate"
  | "getaway"
  | "other";

export const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: "vacation", label: "Vacaciones" },
  { value: "family", label: "Familia" },
  { value: "adventure", label: "Aventura" },
  { value: "honeymoon", label: "Luna de miel" },
  { value: "corporate", label: "Corporativo" },
  { value: "getaway", label: "Escapada" },
  { value: "other", label: "Otro" },
];

export function tripTypeLabel(value: string | null | undefined) {
  if (!value) return "—";
  return TRIP_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Servicios de interés (multiselección). Se guardan por clave estable. */
export const LEAD_SERVICES: { value: string; label: string }[] = [
  { value: "accommodation", label: "Alojamiento" },
  { value: "transfers", label: "Traslados" },
  { value: "excursions", label: "Excursiones" },
  { value: "car_rental", label: "Alquiler de auto" },
  { value: "packages", label: "Paquetes turísticos" },
  { value: "flights", label: "Vuelos" },
  { value: "insurance", label: "Seguro de viaje" },
  { value: "gastronomy", label: "Gastronomía / experiencias" },
  { value: "other", label: "Otro" },
];

export function serviceLabel(value: string) {
  return LEAD_SERVICES.find((s) => s.value === value)?.label ?? value;
}

export function serviceLabels(values: string[] | null | undefined) {
  return (values ?? []).map(serviceLabel);
}

/** Resumen compacto de la necesidad comercial, para listados y avisos. */
export function leadNeedSummary(l: Lead): string {
  const parts: string[] = [];
  if (l.trip_type) parts.push(tripTypeLabel(l.trip_type));
  if (l.destination) parts.push(l.destination);
  const duration = leadDurationLabel(l);
  if (duration) parts.push(duration);
  const pax = leadPaxLabel(l);
  if (pax) parts.push(pax);
  const services = serviceLabels(l.services_interest);
  if (services.length) parts.push(services.slice(0, 3).join(", "));
  return parts.join(" · ");
}

export function leadDurationLabel(
  l: Pick<Lead, "nights_count" | "days_count">,
): string {
  const out: string[] = [];
  if (l.days_count != null) out.push(`${l.days_count} días`);
  if (l.nights_count != null) out.push(`${l.nights_count} noches`);
  return out.join(" / ");
}

export function leadPaxLabel(
  l: Pick<Lead, "pax_count" | "adults_count" | "children_count" | "children_ages">,
): string {
  const detail: string[] = [];
  if (l.adults_count != null) detail.push(`${l.adults_count} adultos`);
  if (l.children_count != null) detail.push(`${l.children_count} niños`);
  if (detail.length === 0) return l.pax_count != null ? `${l.pax_count} pax` : "";
  const base = l.pax_count != null ? `${l.pax_count} pax (${detail.join(", ")})` : detail.join(", ");
  return l.children_ages ? `${base} · edades ${l.children_ages}` : base;
}

/* ------------------------------------------------------------------ */
/* Alta y edición                                                      */
/* ------------------------------------------------------------------ */

export type LeadInput = {
  first_name: string;
  last_name: string;
  whatsapp: string;
  email: string;
  country: string;
  city: string;
  language: string;
  destination: string;
  travel_date: string;
  pax_count: string;
  budget_amount: string;
  budget_currency: string;
  source: LeadSource;
  notes: string;
  assigned_agent_id: string;
  status: LeadStatus;
  /* Necesidad del viaje */
  trip_type: TripType | "";
  services_interest: string[];
  nights_count: string;
  days_count: string;
  adults_count: string;
  children_count: string;
  children_ages: string;
  commercial_notes: string;
};

export const EMPTY_LEAD: LeadInput = {
  first_name: "",
  last_name: "",
  whatsapp: "",
  email: "",
  country: "",
  city: "",
  language: "Español",
  destination: "",
  travel_date: "",
  pax_count: "",
  budget_amount: "",
  budget_currency: "USD",
  source: "whatsapp",
  notes: "",
  assigned_agent_id: "",
  status: "new",
  trip_type: "",
  services_interest: [],
  nights_count: "",
  days_count: "",
  adults_count: "",
  children_count: "",
  children_ages: "",
  commercial_notes: "",
};

export function leadToInput(l: Lead): LeadInput {
  return {
    first_name: l.first_name ?? "",
    last_name: l.last_name ?? "",
    whatsapp: l.whatsapp ?? "",
    email: l.email ?? "",
    country: l.country ?? "",
    city: l.city ?? "",
    language: l.language ?? "",
    destination: l.destination ?? "",
    travel_date: l.travel_date ?? "",
    pax_count: l.pax_count != null ? String(l.pax_count) : "",
    budget_amount: l.budget_amount != null ? String(l.budget_amount) : "",
    budget_currency: l.budget_currency ?? "USD",
    source: l.source as LeadSource,
    notes: l.notes ?? "",
    assigned_agent_id: l.assigned_agent_id ?? "",
    status: l.status as LeadStatus,
    trip_type: (l.trip_type as TripType | null) ?? "",
    services_interest: l.services_interest ?? [],
    nights_count: l.nights_count != null ? String(l.nights_count) : "",
    days_count: l.days_count != null ? String(l.days_count) : "",
    adults_count: l.adults_count != null ? String(l.adults_count) : "",
    children_count: l.children_count != null ? String(l.children_count) : "",
    children_ages: l.children_ages ?? "",
    commercial_notes: l.commercial_notes ?? "",
  };
}

function toPayload(input: LeadInput) {
  const text = (v: string) => (v.trim() === "" ? null : v.trim());
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    first_name: input.first_name.trim(),
    last_name: text(input.last_name),
    whatsapp: text(input.whatsapp),
    email: input.email.trim() ? input.email.trim().toLowerCase() : null,
    country: text(input.country),
    city: text(input.city),
    language: text(input.language),
    destination: text(input.destination),
    travel_date: text(input.travel_date),
    pax_count: num(input.pax_count),
    budget_amount: num(input.budget_amount),
    budget_currency: input.budget_currency || "USD",
    source: input.source,
    notes: text(input.notes),
    assigned_agent_id: input.assigned_agent_id || null,
    status: input.status,
    trip_type: input.trip_type === "" ? null : input.trip_type,
    services_interest: input.services_interest ?? [],
    nights_count: num(input.nights_count),
    days_count: num(input.days_count),
    adults_count: num(input.adults_count),
    children_count: num(input.children_count),
    children_ages: text(input.children_ages),
    commercial_notes: text(input.commercial_notes),
  };
}

export async function listLeads(recordStatus: "active" | "archived" | "all" = "active") {
  let q = supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (recordStatus !== "all") q = q.eq("record_status", recordStatus);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function getLead(id: string) {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Lead | null;
}

export async function createLead(input: LeadInput) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { data, error } = await supabase
    .from("leads")
    .insert({ ...toPayload(input), user_id: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateLead(id: string, input: LeadInput) {
  const { error } = await supabase.from("leads").update(toPayload(input)).eq("id", id);
  if (error) throw error;
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function assignLead(id: string, agentId: string | null) {
  const { error } = await supabase.from("leads").update({ assigned_agent_id: agentId }).eq("id", id);
  if (error) throw error;
}

/** Los leads nunca se eliminan: se archivan para conservar el historial. */
export async function setLeadRecordStatus(id: string, recordStatus: "active" | "archived") {
  const { error } = await supabase.from("leads").update({ record_status: recordStatus }).eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Historial y comentarios                                             */
/* ------------------------------------------------------------------ */

export async function listLeadHistory(leadId: string) {
  const { data, error } = await supabase
    .from("lead_history")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadHistory[];
}

export async function addLeadComment(lead: Lead, comment: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { error } = await supabase.from("lead_history").insert({
    lead_id: lead.id,
    owner_id: lead.user_id,
    actor_id: uid,
    action: "comment",
    comment: comment.trim(),
  });
  if (error) throw error;
}

const HISTORY_LABEL: Record<string, string> = {
  created: "Lead recibido",
  status_changed: "Cambio de estado",
  assigned: "Agente asignado",
  reassigned: "Cambio de asignación",
  converted: "Convertido en cliente",
  comment: "Comentario",
};

export function historyActionLabel(action: string) {
  return HISTORY_LABEL[action] ?? action;
}

/* ------------------------------------------------------------------ */
/* Conversión a cliente (evita duplicados)                             */
/* ------------------------------------------------------------------ */

/**
 * Convierte el lead en cliente del CRM. Si ya existe un cliente con el mismo
 * email o teléfono en la cuenta, se reutiliza en lugar de duplicarlo.
 */
export async function convertLeadToClient(lead: Lead): Promise<string> {
  if (lead.client_id) return lead.client_id;

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");

  const email = lead.email?.toLowerCase() ?? null;
  const phone = lead.whatsapp ?? null;

  let clientId: string | null = null;
  if (email) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    clientId = data?.id ?? null;
  }
  if (!clientId && phone) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    clientId = data?.id ?? null;
  }

  if (!clientId) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        user_id: uid,
        full_name: leadFullName(lead),
        last_name: lead.last_name,
        email,
        phone,
        city: lead.city,
        country: lead.country,
        destination: lead.destination,
        travel_start: lead.travel_date,
        pax_count: lead.pax_count,
        notes: lead.notes,
        opportunity_status: "new" as const,
      })
      .select("id")
      .single();
    if (error) throw error;
    clientId = data.id as string;
  }

  const { error: linkError } = await supabase
    .from("leads")
    .update({ client_id: clientId, converted_at: new Date().toISOString() })
    .eq("id", lead.id);
  if (linkError) throw linkError;

  return clientId;
}

/* ------------------------------------------------------------------ */
/* Asignación de agentes                                               */
/* ------------------------------------------------------------------ */

export type LeadAssignmentMode = "manual" | "automatic";

export type LeadAssignmentRules = {
  by_destination: boolean;
  by_language: boolean;
  by_specialty: boolean;
  by_zone: boolean;
  by_availability: boolean;
  by_active_leads: boolean;
  by_workload: boolean;
  /** Preparadas para el motor automático (todavía sin lógica de puntuación). */
  by_trip_type: boolean;
  by_service: boolean;
};

export const DEFAULT_ASSIGNMENT_RULES: LeadAssignmentRules = {
  by_destination: false,
  by_language: false,
  by_specialty: false,
  by_zone: false,
  by_availability: false,
  by_active_leads: false,
  by_workload: false,
  by_trip_type: false,
  by_service: false,
};

export const ASSIGNMENT_RULE_LABELS: { key: keyof LeadAssignmentRules; label: string }[] = [
  { key: "by_destination", label: "Destino de interés" },
  { key: "by_language", label: "Idioma del lead" },
  { key: "by_trip_type", label: "Tipo de viaje (próximamente)" },
  { key: "by_service", label: "Servicio requerido (próximamente)" },
  { key: "by_specialty", label: "Especialidad del agente" },
  { key: "by_zone", label: "Zona operativa" },
  { key: "by_availability", label: "Disponibilidad del agente" },
  { key: "by_active_leads", label: "Cantidad de leads activos" },
  { key: "by_workload", label: "Carga de trabajo" },
];

export function parseAssignmentRules(value: unknown): LeadAssignmentRules {
  if (!value || typeof value !== "object") return DEFAULT_ASSIGNMENT_RULES;
  const raw = value as Record<string, unknown>;
  const out = { ...DEFAULT_ASSIGNMENT_RULES };
  for (const k of Object.keys(out) as (keyof LeadAssignmentRules)[]) {
    out[k] = raw[k] === true;
  }
  return out;
}

const ACTIVE_LEAD_STATUSES = new Set<string>([
  "new",
  "unassigned",
  "assigned",
  "contacted",
  "quoted",
  "following_up",
]);

/**
 * Sugerencia de asignación automática (arquitectura preparada, sin IA).
 * Aplica sólo los criterios activados y desempata por carga de trabajo.
 * Devuelve `null` cuando ningún agente cumple las reglas.
 */
export function suggestAgentForLead(
  lead: Pick<Lead, "destination" | "language" | "city" | "country">,
  agents: Agent[],
  rules: LeadAssignmentRules,
  activeLeadsByAgent: Record<string, number> = {},
): { agent: Agent; reasons: string[] } | null {
  const eligible = agents.filter(
    (a) => a.status === "active" && a.available_for_assignment && a.auto_receive_leads,
  );
  if (eligible.length === 0) return null;

  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

  const scored = eligible.map((a) => {
    const reasons: string[] = [];
    let score = 0;

    if (rules.by_destination && lead.destination) {
      const d = norm(lead.destination);
      if ((a.specialties ?? []).some((s) => norm(s) && d.includes(norm(s)))) {
        score += 3;
        reasons.push("Destino coincide con su especialidad");
      }
    }
    if (rules.by_language && lead.language) {
      if ((a.languages ?? []).some((l) => norm(l) === norm(lead.language))) {
        score += 2;
        reasons.push("Habla el idioma del lead");
      }
    }
    if (rules.by_specialty && (a.specialties ?? []).length > 0) {
      score += 1;
      reasons.push("Tiene especialidades cargadas");
    }
    if (rules.by_zone && (lead.city || lead.country)) {
      const zone = norm(a.main_zone);
      if (zone && (norm(lead.city).includes(zone) || norm(lead.country).includes(zone))) {
        score += 2;
        reasons.push("Zona operativa coincide");
      }
    }
    if (rules.by_availability) {
      if (a.availability === "available") {
        score += 2;
        reasons.push("Agente disponible");
      } else {
        score -= 2;
      }
    }

    const active = activeLeadsByAgent[a.id] ?? 0;
    if (rules.by_active_leads && a.max_active_clients != null && active >= a.max_active_clients) {
      score -= 5;
      reasons.push("Alcanzó su máximo de clientes activos");
    }
    if (rules.by_workload) {
      score -= active * 0.5;
    }

    score += (a.priority ?? 0) * 0.25;
    return { agent: a, score, active, reasons };
  });

  scored.sort((x, y) => y.score - x.score || x.active - y.active);
  const best = scored[0];
  if (!best || best.score <= 0) return null;
  return { agent: best.agent, reasons: best.reasons };
}

export function countActiveLeadsByAgent(leads: Lead[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of leads) {
    if (!l.assigned_agent_id) continue;
    if (!ACTIVE_LEAD_STATUSES.has(l.status)) continue;
    out[l.assigned_agent_id] = (out[l.assigned_agent_id] ?? 0) + 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Métricas comerciales                                                */
/* ------------------------------------------------------------------ */

export type LeadStats = {
  total: number;
  unassigned: number;
  assigned: number;
  contacted: number;
  quoted: number;
  won: number;
  lost: number;
  conversion: number;
};

export function computeLeadStats(leads: Lead[]): LeadStats {
  const total = leads.length;
  const won = leads.filter((l) => l.status === "won").length;
  const lost = leads.filter((l) => l.status === "lost").length;
  const closed = won + lost;
  return {
    total,
    unassigned: leads.filter((l) => l.assigned_agent_id == null).length,
    assigned: leads.filter((l) => l.assigned_agent_id != null).length,
    contacted: leads.filter((l) =>
      ["contacted", "quoted", "following_up", "won"].includes(l.status),
    ).length,
    quoted: leads.filter((l) => ["quoted", "won"].includes(l.status)).length,
    won,
    lost,
    conversion: closed > 0 ? Math.round((won / closed) * 100) : 0,
  };
}

export async function listLeadsByAgent(agentId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("assigned_agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lead[];
}
