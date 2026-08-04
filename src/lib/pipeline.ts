import { supabase } from "@/integrations/supabase/client";
import type { Opportunity, StageConfig } from "@/lib/opportunities";
import { OPPORTUNITY_STAGES, stageGroup } from "@/lib/opportunities";

/**
 * Helpers del Pipeline Comercial Kanban (v1.10.8.2).
 * No crea tablas nuevas: sólo lee `opportunities`, `opportunity_stage_config`
 * y `opportunity_history`, respetando las políticas RLS existentes.
 */

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Opportunity) ?? null;
}

/** Agente de la red comercial vinculado al usuario autenticado (si existe). */
export async function currentAgentId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_agent_id");
  if (error) return null;
  return (data as string | null) ?? null;
}

/** Etapas del pipeline con fallback al catálogo local si la tabla está vacía. */
export function resolveStages(config: StageConfig[]) {
  if (config.length > 0) {
    return config.map((c) => ({
      stage: c.stage as string,
      label: c.display_name,
      group: c.pipeline_group as "open" | "won" | "lost",
      sortOrder: c.sort_order,
    }));
  }
  return OPPORTUNITY_STAGES.map((s, i) => ({
    stage: s.value as string,
    label: s.label,
    group: stageGroup(s.value),
    sortOrder: i,
  }));
}

export type PipelineStage = ReturnType<typeof resolveStages>[number];

export const PIPELINE_GROUP_LABEL: Record<string, string> = {
  open: "En curso",
  won: "Ganadas",
  lost: "Cerradas sin venta",
};

/** Antigüedad en la etapa actual, en días completos. */
export function daysInStage(o: Pick<Opportunity, "stage_changed_at" | "created_at">) {
  const ref = o.stage_changed_at ?? o.created_at;
  if (!ref) return null;
  const ms = Date.now() - new Date(ref).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function daysInStageLabel(o: Pick<Opportunity, "stage_changed_at" | "created_at">) {
  const d = daysInStage(o);
  if (d == null) return "—";
  if (d === 0) return "Hoy";
  if (d === 1) return "1 día en etapa";
  return `${d} días en etapa`;
}

/** Totales por moneda de una columna (sin conversión de moneda todavía). */
export function sumByCurrency(items: Opportunity[]) {
  const map = new Map<string, number>();
  for (const o of items) {
    const cur = o.currency || "USD";
    map.set(cur, (map.get(cur) ?? 0) + Number(o.estimated_value ?? 0));
  }
  return [...map.entries()].map(([currency, total]) => ({ currency, total }));
}

/** Permisos de UI: la validación real la aplican RLS y los triggers. */
export function canEditOpportunity(args: {
  opportunity: Opportunity;
  isAdmin: boolean;
  userId: string | null;
  agentId: string | null;
}) {
  const { opportunity: o, isAdmin, userId, agentId } = args;
  if (isAdmin) return true;
  if (userId && (o.owner_user_id === userId || o.user_id === userId)) return true;
  if (agentId && o.assigned_agent_id === agentId) return true;
  return false;
}
