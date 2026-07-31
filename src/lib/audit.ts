import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AuditRow = Tables<"audit_log">;

export const AUDIT_ENTITIES = [
  { value: "all", label: "Todas las entidades" },
  { value: "clients", label: "Clientes" },
  { value: "agents", label: "Agentes" },
  { value: "opportunities", label: "Oportunidades" },
  { value: "quotations", label: "Cotizaciones" },
  { value: "bookings", label: "Reservas" },
  { value: "companies", label: "Empresas" },
  { value: "resources", label: "Recursos" },
  { value: "booking_resources", label: "Recursos asignados" },
  { value: "providers", label: "Proveedores" },
  { value: "provider_evaluations", label: "Evaluaciones de proveedor" },
  { value: "company_settings", label: "Configuración" },
] as const;

const ENTITY_LABEL: Record<string, string> = {
  clients: "Cliente",
  agents: "Agente",
  opportunities: "Oportunidad",
  quotations: "Cotización",
  bookings: "Reserva",
  companies: "Empresa",
  resources: "Recurso",
  booking_resources: "Recurso asignado",
  providers: "Proveedor",
  provider_evaluations: "Evaluación de proveedor",
  company_settings: "Configuración",
};


const ACTION_LABEL: Record<string, string> = {
  created: "creó",
  updated: "actualizó",
  deleted: "eliminó",
  archived: "archivó",
  unarchived: "restauró",
  status_changed: "cambió el estado de",
  agent_assigned: "reasignó el agente de",
};

export function entityLabel(entity: string) {
  return ENTITY_LABEL[entity] ?? entity;
}

export function actionLabel(action: string) {
  return ACTION_LABEL[action] ?? action;
}

/** Registro global de auditoría. Solo accesible para administradores (RLS). */
export async function listAuditLog(entity = "all", limit = 100): Promise<AuditRow[]> {
  let q = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (entity !== "all") q = q.eq("entity", entity);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AuditRow[];
}

/** Nombres de los campos modificados en un registro de auditoría. */
export function changedFields(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  const d = details as Record<string, unknown>;
  const changes = (d.changes ?? d) as Record<string, unknown>;
  if (!changes || typeof changes !== "object") return [];
  return Object.keys(changes).filter((k) => k !== "updated_at");
}
