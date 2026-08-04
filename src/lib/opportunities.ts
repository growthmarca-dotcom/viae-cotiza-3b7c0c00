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
  /** Fecha estimada de cierre comercial (v1.10.8.1). */
  expected_close_date: string | null;
  /** Motivo de pérdida o cancelación (v1.10.8.1). */
  lost_reason: string | null;
  /** Orden manual dentro de la columna del pipeline (v1.10.8.1). */
  position: number | null;
}>;

export async function updateOpportunity(id: string, patch: OpportunityPatch) {
  const { error } = await supabase.from("opportunities").update(patch).eq("id", id);
  if (error) throw new Error(opportunityUpdateErrorMessage(error));
}

// ============================================================
// Configuración de etapas (v1.10.8.1)
// La metadata del pipeline vive en `opportunity_stage_config`.
// `OPPORTUNITY_STAGES` se mantiene como fallback durante la migración.
// ============================================================

export type StageConfig = Tables<"opportunity_stage_config">;
export type PipelineGroup = "open" | "won" | "lost";

/** Etapas del pipeline ordenadas, tal como están configuradas en la base. */
export async function listStageConfig(includeInactive = false) {
  let q = supabase
    .from("opportunity_stage_config")
    .select("*")
    .order("sort_order", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StageConfig[];
}

/** Grupo del pipeline derivado del catálogo local (fallback sin consulta). */
export function stageGroup(value: string): PipelineGroup {
  if (value === "booked" || value === "completed") return "won";
  if (value === "lost" || value === "cancelled") return "lost";
  return "open";
}

// ============================================================
// Historial de etapas (v1.10.8.1)
// ============================================================

export type OpportunityHistoryRow = Tables<"opportunity_history">;

export async function listOpportunityHistory(opportunityId: string) {
  const { data, error } = await supabase
    .from("opportunity_history")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OpportunityHistoryRow[];
}

/**
 * Traduce los bloqueos de los triggers de actualización
 * (`opportunities_guard_update`) a mensajes en español.
 */
export function opportunityUpdateErrorMessage(error: {
  message?: string;
  hint?: string | null;
}): string {
  const msg = error.message ?? "No se pudo actualizar la oportunidad";
  if (error.hint === "agent_field_not_allowed" || msg.includes("commercial fields")) {
    return "Como agente asignado sólo podés editar etapa, próxima acción, notas y fecha estimada de cierre.";
  }
  if (error.hint === "organization_mismatch" || msg.includes("different organizations")) {
    return "El cambio deja la oportunidad en una organización distinta a su cotización o reserva.";
  }
  if (error.hint === "not_allowed_for_organization") {
    return "No tenés permisos sobre esa organización.";
  }
  return msg;
}

/**
 * Mueve una oportunidad de etapa (base del Pipeline Kanban).
 * El sello de `stage_changed_at` y el registro en `opportunity_history`
 * los realizan los triggers de la base de datos; la coherencia de
 * organización y los permisos se validan del lado del servidor.
 */
export async function moveOpportunityStage(args: {
  id: string;
  stage: OpportunityStage;
  /** Posición dentro de la columna destino (orden Kanban). */
  position?: number | null;
  /** Motivo obligatorio a nivel de negocio cuando la etapa es perdida/cancelada. */
  lostReason?: string | null;
}) {
  const { data: current, error: readError } = await supabase
    .from("opportunities")
    .select("id, stage")
    .eq("id", args.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) throw new Error("La oportunidad no existe o no tenés acceso.");
  if (current.stage === args.stage && args.position == null) return;

  const patch: OpportunityPatch = { stage: args.stage };
  if (args.position != null) patch.position = args.position;
  if (stageGroup(args.stage) === "lost") patch.lost_reason = args.lostReason ?? null;

  await updateOpportunity(args.id, patch);
}


/**
 * Traduce el bloqueo del trigger `opportunities_require_organization`
 * a un mensaje comprensible para el agente.
 */
export function opportunityCreateErrorMessage(error: {
  message?: string;
  hint?: string | null;
}): string {
  const msg = error.message ?? "No se pudo crear la oportunidad";
  if (msg.includes("different organizations")) {
    return "La oportunidad y la cotización pertenecen a organizaciones distintas.";
  }
  if (!msg.includes("Opportunity requires a valid organization")) return msg;
  switch (error.hint) {
    case "ambiguous_organization":
      return "Pertenecés a más de una organización: elegí la organización propietaria de la oportunidad.";
    case "not_allowed_for_organization":
      return "No tenés permisos para crear oportunidades en esa organización.";
    default:
      return "La oportunidad necesita una organización comercial propietaria válida.";
  }
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
  /**
   * Organización comercial propietaria. Si se omite, la resuelve el motor
   * `resolve_opportunity_organization()` en la base de datos (v1.10.7.2.3).
   */
  organizationId?: string | null;
}) {
  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      user_id: input.userId,
      owner_user_id: input.userId,
      client_id: input.clientId,
      quotation_id: input.quotationId ?? null,
      organization_id: input.organizationId ?? null,
      title: input.title || "Oportunidad",
      stage: input.stage ?? "new",
      lead_source: input.leadSource ?? "other",
      estimated_value: input.estimatedValue ?? 0,
      currency: input.currency ?? "USD",
      probability: input.probability ?? 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(opportunityCreateErrorMessage(error));
  return data.id as string;
}

/**
 * Cada cotización queda relacionada a una oportunidad comercial.
 * - Conserva la oportunidad existente (pasada o vinculada a la cotización).
 * - Al crear una nueva hereda la organización de la cotización.
 * - Nunca crea oportunidades huérfanas (sin cliente) ni bloquea la cotización.
 */
export async function ensureOpportunityForQuotation(args: {
  userId: string;
  clientId: string | null;
  quotationId: string;
  title: string;
  amount: number;
  currency: string;
  /** Oportunidad ya identificada para esta cotización. */
  opportunityId?: string | null;
  /** Organización propietaria de la cotización. */
  organizationId?: string | null;
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

    // La organización de la nueva oportunidad debe coincidir con la de la cotización.
    let organizationId = args.organizationId ?? null;
    if (!organizationId) {
      const { data: q } = await supabase
        .from("quotations")
        .select("organization_id")
        .eq("id", args.quotationId)
        .maybeSingle();
      organizationId = q?.organization_id ?? null;
    }

    return await createOpportunity({
      userId: args.userId,
      clientId: args.clientId,
      quotationId: args.quotationId,
      organizationId,
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
