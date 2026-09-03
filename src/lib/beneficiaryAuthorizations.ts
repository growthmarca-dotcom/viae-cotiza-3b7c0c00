import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Autorización unificada de beneficiarios de comisión.
 *
 * Fuente única de verdad para responder "¿esta persona/agente u organización
 * está autorizada a recibir comisiones?". Sustituye funcionalmente al booleano
 * `agents.settlement_authorized` (que permanece en la base sólo por
 * compatibilidad histórica y ya no se usa ni se muestra).
 *
 * No participa del cálculo: los importes siempre provienen del motor de
 * acuerdos (`commercial_agreements` → `agreement_rules`). La autorización sólo
 * determina quién puede entrar al circuito de nuevas liquidaciones.
 *
 * Autorización ≠ permiso de visualización. Ser beneficiario autorizado no
 * otorga permisos administrativos ni de lectura económica ampliada.
 */

export type BeneficiaryAuthorization = Tables<"commission_beneficiary_authorizations">;
export type BeneficiaryAuthorizationHistory =
  Tables<"commission_beneficiary_authorization_history">;

/** Sólo agentes/personas y organizaciones pueden ser beneficiarios. */
export type BeneficiaryType = "agent" | "organization";

export type BeneficiaryAuthorizationStatus = "authorized" | "revoked";

/** Estado derivado para la UI: nunca autorizado / autorizado / revocado. */
export type BeneficiaryState = "never" | "authorized" | "revoked";

export function beneficiaryStateLabel(state: BeneficiaryState) {
  switch (state) {
    case "authorized":
      return "Autorizado";
    case "revoked":
      return "Revocado";
    default:
      return "Nunca autorizado";
  }
}

export function beneficiaryStateClasses(state: BeneficiaryState) {
  switch (state) {
    case "authorized":
      return "bg-primary/10 text-primary border-primary/30";
    case "revoked":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Última autorización (activa o revocada) del beneficiario. */
export async function getBeneficiaryAuthorization(
  type: BeneficiaryType,
  id: string,
): Promise<BeneficiaryAuthorization | null> {
  const { data, error } = await supabase
    .from("commission_beneficiary_authorizations")
    .select("*")
    .eq("beneficiary_type", type)
    .eq("beneficiary_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as BeneficiaryAuthorization) ?? null;
}

export async function listBeneficiaryAuthorizationHistory(
  type: BeneficiaryType,
  id: string,
): Promise<BeneficiaryAuthorizationHistory[]> {
  const { data, error } = await supabase
    .from("commission_beneficiary_authorization_history")
    .select("*")
    .eq("beneficiary_type", type)
    .eq("beneficiary_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BeneficiaryAuthorizationHistory[];
}

/** Autorizaciones activas de un tipo, para listados. */
export async function listActiveBeneficiaryAuthorizations(
  type: BeneficiaryType,
): Promise<BeneficiaryAuthorization[]> {
  const { data, error } = await supabase
    .from("commission_beneficiary_authorizations")
    .select("*")
    .eq("beneficiary_type", type)
    .eq("status", "authorized");
  if (error) throw error;
  return (data ?? []) as BeneficiaryAuthorization[];
}

export function beneficiaryState(auth: BeneficiaryAuthorization | null): BeneficiaryState {
  if (!auth) return "never";
  return auth.status === "authorized" ? "authorized" : "revoked";
}

const AUTHORIZE_ERRORS: Record<string, string> = {
  not_authenticated: "Sesión no válida.",
  forbidden: "Sólo un administrador puede gestionar autorizaciones.",
  unsupported_beneficiary_type: "Tipo de beneficiario no admitido.",
  agent_not_found: "El agente no existe.",
  organization_not_found: "La organización no existe.",
  self_authorization_forbidden: "No es posible autorizar al beneficiario propio.",
  reason_required: "El motivo de la revocación es obligatorio.",
  no_active_authorization: "El beneficiario no tiene una autorización activa.",
};

function unwrap(result: unknown): { created?: boolean; authorization_id?: string } {
  const r = (result ?? {}) as {
    ok?: boolean;
    reason?: string;
    created?: boolean;
    authorization_id?: string;
  };
  if (!r.ok) {
    throw new Error(AUTHORIZE_ERRORS[r.reason ?? ""] ?? "No se pudo completar la operación.");
  }
  return r;
}

/** Autoriza a un beneficiario. Toda validación ocurre en el servidor. */
export async function authorizeBeneficiary(
  type: BeneficiaryType,
  id: string,
  reason?: string,
  notes?: string,
) {
  const { data, error } = await supabase.rpc("authorize_commission_beneficiary", {
    _beneficiary_type: type,
    _beneficiary_id: id,
    _reason: reason?.trim() ? reason.trim() : undefined,
    _notes: notes?.trim() ? notes.trim() : undefined,
  });
  if (error) throw error;
  return unwrap(data);
}

/** Revoca la autorización activa. Conserva el registro histórico. */
export async function revokeBeneficiary(type: BeneficiaryType, id: string, reason: string) {
  if (!reason.trim()) throw new Error("El motivo de la revocación es obligatorio.");
  const { data, error } = await supabase.rpc("revoke_commission_beneficiary", {
    _beneficiary_type: type,
    _beneficiary_id: id,
    _reason: reason.trim(),
  });
  if (error) throw error;
  return unwrap(data);
}
