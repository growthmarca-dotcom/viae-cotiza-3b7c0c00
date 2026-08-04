import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Opportunity = Tables<"opportunities">;

export type OpportunityStage =
  | "new"
  | "contacted"
  | "quoted"
  | "following_up"
  | "negotiating"
  | "booked"
  | "completed"
  | "lost"
  | "cancelled";

export type LeadSource =
  | "website"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "google"
  | "referral"
  | "existing_client"
  | "other";

/** Estados del pipeline comercial, en el orden en el que avanzan. */
export const OPPORTUNITY_STAGES: { value: OpportunityStage; label: string }[] = [
  { value: "new", label: "Nuevo" },
  { value: "contacted", label: "Contactado" },
  { value: "quoted", label: "Cotización enviada" },
  { value: "following_up", label: "En seguimiento" },
  { value: "negotiating", label: "Negociación" },
  { value: "booked", label: "Reserva confirmada" },
  { value: "completed", label: "Viaje finalizado" },
  { value: "lost", label: "Perdida" },
  { value: "cancelled", label: "Cancelada" },
];

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: "website", label: "Sitio web" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "referral", label: "Referido" },
  { value: "existing_client", label: "Cliente existente" },
  { value: "other", label: "Otro" },
];

/** Próximas acciones sugeridas (texto libre permitido con "Otro"). */
export const NEXT_ACTIONS = [
  "Llamar",
  "Enviar documentación",
  "Esperar respuesta",
  "Enviar nueva propuesta",
  "Cobrar seña",
  "Emitir voucher",
  "Otro",
] as const;

export function stageLabel(value: string) {
  return OPPORTUNITY_STAGES.find((s) => s.value === value)?.label ?? value;
}

export function sourceLabel(value: string) {
  return LEAD_SOURCES.find((s) => s.value === value)?.label ?? value;
}

export function stageClasses(value: string) {
  switch (value) {
    case "booked":
    case "completed":
      return "bg-primary/10 text-primary border-primary/30";
    case "lost":
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "quoted":
    case "following_up":
    case "negotiating":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Estado de archivo del registro (las oportunidades nunca se eliminan). */
export type RecordStatus = "active" | "archived" | "inactive" | "suspended";

export const OPPORTUNITY_RECORD_STATUSES: { value: RecordStatus; label: string }[] = [
  { value: "active", label: "Activa" },
  { value: "archived", label: "Archivada" },
  { value: "inactive", label: "Inactiva" },
  { value: "suspended", label: "Suspendida" },
];

export async function listOpportunitiesByClient(
  clientId: string,
  recordStatus: RecordStatus | "all" = "active",
) {
  let q = supabase
    .from("opportunities")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (recordStatus !== "all") q = q.eq("record_status", recordStatus);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Opportunity[];
}

export async function listOpportunities(recordStatus: RecordStatus | "all" = "active") {
  let q = supabase.from("opportunities").select("*").order("created_at", { ascending: false });
  if (recordStatus !== "all") q = q.eq("record_status", recordStatus);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Opportunity[];
}

/** Las oportunidades nunca se eliminan definitivamente: sólo se archivan. */
export async function setOpportunityRecordStatus(id: string, recordStatus: RecordStatus) {
  const { error } = await supabase
    .from("opportunities")
    .update({ record_status: recordStatus })
    .eq("id", id);
  if (error) throw error;
}

export type OpportunityPatch = Partial<{
  stage: OpportunityStage;
  lead_source: LeadSource;
  estimated_value: number;
  currency: string;
  probability: number;
  next_action: string | null;
  next_contact_date: string | null;
  /**
   * Responsable de la oportunidad. Hoy es siempre un usuario autenticado.
   * En una versión futura podrá apuntar a un Agente del sistema
   * (columna `assigned_agent_id`, ya reservada en la base de datos).
   */
  owner_user_id: string;
  /** Agente de la red comercial asignado a la oportunidad (módulo Agentes). */
  assigned_agent_id: string | null;
  title: string;
  notes: string | null;
}>;

export async function updateOpportunity(id: string, patch: OpportunityPatch) {
  const { error } = await supabase.from("opportunities").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createOpportunity(input: {
  userId: string;
  clientId: string;
  quotationId?: string | null;
  title: string;
  stage?: OpportunityStage;
  leadSource?: LeadSource;
  estimatedValue?: number;
  currency?: string;
  probability?: number;
}) {
  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      user_id: input.userId,
      owner_user_id: input.userId,
      client_id: input.clientId,
      quotation_id: input.quotationId ?? null,
      title: input.title || "Oportunidad",
      stage: input.stage ?? "new",
      lead_source: input.leadSource ?? "other",
      estimated_value: input.estimatedValue ?? 0,
      currency: input.currency ?? "USD",
      probability: input.probability ?? 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Cada cotización genera automáticamente una oportunidad comercial.
 * Si la cotización ya tiene una, sólo se actualiza el valor estimado.
 * Nunca debe bloquear la creación de la cotización.
 */
export async function ensureOpportunityForQuotation(args: {
  userId: string;
  clientId: string | null;
  quotationId: string;
  title: string;
  amount: number;
  currency: string;
  /** Oportunidad ya existente a la que pertenece la cotización. */
  opportunityId?: string | null;
}): Promise<string | null> {
  if (!args.clientId) return null;
  try {
    if (args.opportunityId) {
      await updateOpportunity(args.opportunityId, {
        estimated_value: args.amount,
        currency: args.currency,
      });
      return args.opportunityId;
    }

    const { data: existing } = await supabase
      .from("opportunities")
      .select("id")
      .eq("quotation_id", args.quotationId)
      .maybeSingle();

    if (existing?.id) {
      await updateOpportunity(existing.id, {
        estimated_value: args.amount,
        currency: args.currency,
      });
      return existing.id;
    }


    return await createOpportunity({
      userId: args.userId,
      clientId: args.clientId,
      quotationId: args.quotationId,
      title: args.title,
      stage: "quoted",
      leadSource: "other",
      estimatedValue: args.amount,
      currency: args.currency,
      probability: 30,
    });
  } catch (err) {
    console.error("No se pudo sincronizar la oportunidad comercial", err);
    return null;
  }
}
