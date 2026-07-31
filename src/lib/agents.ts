import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Opportunity } from "@/lib/opportunities";
import type { AgentAvailability } from "@/lib/resources";

export type { AgentAvailability };

export type Agent = Tables<"agents">;

export type AgentStatus = "pending" | "training" | "active" | "suspended" | "inactive" | "archived";
export type CommissionType = "percentage" | "fixed";
export type AgentAccessStatus = "none" | "invited" | "linked";
export type AgentWaStatus = "available" | "busy" | "offline";

export const AGENT_STATUSES: { value: AgentStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "training", label: "En capacitación" },
  { value: "active", label: "Activo" },
  { value: "suspended", label: "Suspendido" },
  { value: "inactive", label: "Inactivo" },
  { value: "archived", label: "Archivado" },
];

export const AGENT_LANGUAGES = [
  "Español",
  "Inglés",
  "Portugués",
  "Francés",
  "Italiano",
  "Alemán",
  "Otro",
] as const;

export const AGENT_SPECIALTIES = [
  "Patagonia",
  "Argentina",
  "Chile",
  "Brasil",
  "Internacional",
  "Corporativo",
  "Grupos",
  "Ski",
  "Aventura",
  "Lujo",
  "Cruceros",
  "Otro",
] as const;

export const COMMISSION_TYPES: { value: CommissionType; label: string }[] = [
  { value: "percentage", label: "Porcentaje" },
  { value: "fixed", label: "Monto fijo" },
];

export const AGENT_ACCESS_STATUSES: { value: AgentAccessStatus; label: string }[] = [
  { value: "none", label: "Sin acceso" },
  { value: "linked", label: "Usuario vinculado" },
  { value: "invited", label: "Invitar usuario" },
];

export const AGENT_WA_STATUSES: { value: AgentWaStatus; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "busy", label: "Ocupado" },
  { value: "offline", label: "Desconectado" },
];

export function agentStatusLabel(value: string) {
  return AGENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function agentStatusClasses(value: string) {
  switch (value) {
    case "active":
      return "bg-primary/10 text-primary border-primary/30";
    case "suspended":
    case "inactive":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "training":
    case "pending":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function agentFullName(a: Pick<Agent, "first_name" | "last_name">) {
  return [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
}

export type AgentInput = {
  first_name: string;
  last_name: string;
  company: string;
  whatsapp: string;
  email: string;
  city: string;
  state: string;
  country: string;
  languages: string[];
  specialties: string[];
  notes: string;
  status: AgentStatus;
  commission_type: CommissionType | "";
  commission_value: string;
  commission_currency: string;
  access_status: AgentAccessStatus;
  invited_email: string;
  wa_number: string;
  wa_extension: string;
  wa_status: AgentWaStatus;
  main_zone: string;
  priority: string;
  max_active_clients: string;
  max_open_opportunities: string;
  auto_receive_leads: boolean;
  available_for_assignment: boolean;
  availability: AgentAvailability;
};

export const EMPTY_AGENT: AgentInput = {
  first_name: "",
  last_name: "",
  company: "",
  whatsapp: "",
  email: "",
  city: "",
  state: "",
  country: "",
  languages: [],
  specialties: [],
  notes: "",
  status: "pending",
  commission_type: "",
  commission_value: "",
  commission_currency: "USD",
  access_status: "none",
  invited_email: "",
  wa_number: "",
  wa_extension: "",
  wa_status: "offline",
  main_zone: "",
  priority: "0",
  max_active_clients: "",
  max_open_opportunities: "",
  auto_receive_leads: false,
  available_for_assignment: true,
  availability: "available",
};

export function agentToInput(a: Agent): AgentInput {
  return {
    first_name: a.first_name ?? "",
    last_name: a.last_name ?? "",
    company: a.company ?? "",
    whatsapp: a.whatsapp ?? "",
    email: a.email ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    country: a.country ?? "",
    languages: a.languages ?? [],
    specialties: a.specialties ?? [],
    notes: a.notes ?? "",
    status: a.status as AgentStatus,
    commission_type: (a.commission_type as CommissionType | null) ?? "",
    commission_value: a.commission_value != null ? String(a.commission_value) : "",
    commission_currency: a.commission_currency ?? "USD",
    access_status: a.access_status as AgentAccessStatus,
    invited_email: a.invited_email ?? "",
    wa_number: a.wa_number ?? "",
    wa_extension: a.wa_extension ?? "",
    wa_status: a.wa_status as AgentWaStatus,
    main_zone: a.main_zone ?? "",
    priority: String(a.priority ?? 0),
    max_active_clients: a.max_active_clients != null ? String(a.max_active_clients) : "",
    max_open_opportunities:
      a.max_open_opportunities != null ? String(a.max_open_opportunities) : "",
    auto_receive_leads: a.auto_receive_leads ?? false,
    available_for_assignment: a.available_for_assignment ?? true,
    availability: (a.availability as AgentAvailability) ?? "available",
  };
}

function toPayload(input: AgentInput) {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const text = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    first_name: input.first_name.trim(),
    last_name: text(input.last_name),
    company: text(input.company),
    whatsapp: text(input.whatsapp),
    email: text(input.email),
    city: text(input.city),
    state: text(input.state),
    country: text(input.country),
    languages: input.languages,
    specialties: input.specialties,
    notes: text(input.notes),
    status: input.status,
    commission_type: input.commission_type === "" ? null : input.commission_type,
    commission_value: num(input.commission_value),
    commission_currency: input.commission_currency || "USD",
    access_status: input.access_status,
    invited_email: text(input.invited_email),
    invited_at: input.access_status === "invited" ? new Date().toISOString() : null,
    wa_number: text(input.wa_number),
    wa_extension: text(input.wa_extension),
    wa_status: input.wa_status,
    main_zone: text(input.main_zone),
    priority: Number(input.priority) || 0,
    max_active_clients: num(input.max_active_clients),
    max_open_opportunities: num(input.max_open_opportunities),
    auto_receive_leads: input.auto_receive_leads,
    available_for_assignment: input.available_for_assignment,
    availability: input.availability,
  };
}

export async function listAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Agent[];
}

/** Agentes disponibles para asignar en el pipeline (no archivados). */
export async function listAssignableAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .neq("status", "archived")
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Agent[];
}

export async function getAgent(id: string): Promise<Agent | null> {
  const { data, error } = await supabase.from("agents").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Agent) ?? null;
}

export async function createAgent(input: AgentInput) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  const { data, error } = await supabase
    .from("agents")
    .insert({ ...toPayload(input), created_by: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateAgent(id: string, input: AgentInput) {
  const { error } = await supabase.from("agents").update(toPayload(input)).eq("id", id);
  if (error) throw error;
}

/** Los agentes nunca se eliminan: sólo cambian de estado. */
export async function setAgentStatus(id: string, status: AgentStatus) {
  const { error } = await supabase.from("agents").update({ status }).eq("id", id);
  if (error) throw error;
}

export type AgentStats = {
  clients: number;
  activeOpportunities: number;
  quotationsSent: number;
  bookings: number;
  lost: number;
  conversion: number;
  estimatedValue: number;
  soldValue: number;
  averageTicket: number;
};

const CLOSED_WON = new Set(["booked", "completed"]);
const CLOSED_LOST = new Set(["lost", "cancelled"]);

/** Estadísticas derivadas de las oportunidades asignadas al agente. */
export function computeAgentStats(opportunities: Opportunity[]): AgentStats {
  const clients = new Set(opportunities.map((o) => o.client_id)).size;
  const activeOpportunities = opportunities.filter(
    (o) => !CLOSED_WON.has(o.stage) && !CLOSED_LOST.has(o.stage),
  ).length;
  const quotationsSent = opportunities.filter((o) => o.quotation_id != null).length;
  const won = opportunities.filter((o) => CLOSED_WON.has(o.stage));
  const lost = opportunities.filter((o) => CLOSED_LOST.has(o.stage)).length;
  const closed = won.length + lost;
  const estimatedValue = opportunities.reduce((s, o) => s + Number(o.estimated_value ?? 0), 0);
  const soldValue = won.reduce((s, o) => s + Number(o.estimated_value ?? 0), 0);
  return {
    clients,
    activeOpportunities,
    quotationsSent,
    bookings: won.length,
    lost,
    conversion: closed > 0 ? Math.round((won.length / closed) * 100) : 0,
    estimatedValue,
    soldValue,
    averageTicket: won.length > 0 ? soldValue / won.length : 0,
  };
}

export async function listOpportunitiesByAgent(agentId: string): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("assigned_agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Opportunity[];
}

/* ------------------------------------------------------------------ */
/* Vinculación agente ↔ usuario e invitaciones                         */
/* ------------------------------------------------------------------ */

export type InvitationStatus = "pending" | "accepted" | "rejected" | "expired";

export const INVITATION_STATUSES: { value: InvitationStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "accepted", label: "Aceptada" },
  { value: "rejected", label: "Rechazada" },
  { value: "expired", label: "Expirada" },
];

export function invitationStatusLabel(value: string | null) {
  if (!value) return "Sin invitación";
  return INVITATION_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function invitationStatusClasses(value: string | null) {
  switch (value) {
    case "accepted":
      return "bg-primary/10 text-primary border-primary/30";
    case "rejected":
    case "expired":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "pending":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Una invitación vence a los 7 días. Marca como expiradas las vencidas. */
export function isInvitationExpired(a: Pick<Agent, "invitation_status" | "invitation_expires_at">) {
  if (a.invitation_status !== "pending" || !a.invitation_expires_at) return false;
  return new Date(a.invitation_expires_at).getTime() < Date.now();
}

export type LinkableProfile = {
  id: string;
  full_name: string | null;
  agency_name: string | null;
};

/** Usuarios de la plataforma disponibles para vincular con un agente. */
export async function listLinkableProfiles(): Promise<LinkableProfile[]> {
  const [{ data: profiles, error }, { data: linked }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, agency_name").order("full_name"),
    supabase.from("agents").select("user_id").not("user_id", "is", null),
  ]);
  if (error) throw error;
  const taken = new Set((linked ?? []).map((r) => r.user_id as string));
  return (profiles ?? []).filter((p) => !taken.has(p.id)) as LinkableProfile[];
}

/**
 * Registra la invitación de un usuario para el agente.
 * El envío real del email se implementará más adelante: por ahora sólo
 * se persiste el estado y la fecha de expiración.
 */
export async function inviteAgentUser(agentId: string, email: string) {
  const { data: userData } = await supabase.auth.getUser();
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  const { error } = await supabase
    .from("agents")
    .update({
      access_status: "invited",
      invited_email: email.trim().toLowerCase(),
      invited_at: new Date().toISOString(),
      invited_by: userData.user?.id ?? null,
      invitation_status: "pending",
      invitation_expires_at: expires.toISOString(),
    })
    .eq("id", agentId);
  if (error) throw error;
}

export async function setInvitationStatus(agentId: string, status: InvitationStatus) {
  const { error } = await supabase
    .from("agents")
    .update({
      invitation_status: status,
      access_status: status === "accepted" ? "invited" : "none",
    })
    .eq("id", agentId);
  if (error) throw error;
}

/** Vincula (o reemplaza) el usuario que opera como este agente. */
export async function linkAgentUser(agentId: string, userId: string) {
  const { error } = await supabase
    .from("agents")
    .update({
      user_id: userId,
      access_status: "linked",
      invitation_status: "accepted",
    })
    .eq("id", agentId);
  if (error) throw error;
}

export async function unlinkAgentUser(agentId: string) {
  const { error } = await supabase
    .from("agents")
    .update({
      user_id: null,
      access_status: "none",
      linked_at: null,
      linked_by: null,
      invitation_status: null,
    })
    .eq("id", agentId);
  if (error) throw error;
}
