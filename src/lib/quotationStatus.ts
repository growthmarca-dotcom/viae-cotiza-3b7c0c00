import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export type QuotationStatus = Enums<"quotation_status">;

/**
 * Ciclo comercial V1: draft → sent → accepted / rejected / expired.
 * Espejo exacto de `public.quotation_status_can_transition` en la base.
 * `accepted` es terminal: nunca vuelve a borrador.
 */
export const ALLOWED_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ["sent", "expired"],
  sent: ["pending", "accepted", "rejected", "expired"],
  pending: ["accepted", "rejected", "expired"],
  rejected: ["sent"],
  expired: ["sent"],
  accepted: [],
};

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};

export const STATUS_STYLE: Record<QuotationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-secondary text-secondary-foreground",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  accepted: "bg-primary/15 text-primary",
  rejected: "bg-destructive/15 text-destructive",
  expired: "bg-muted text-muted-foreground line-through",
};

export function canTransition(from: QuotationStatus, to: QuotationStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** ¿La cotización quedó vencida según su fecha de validez? */
export function isQuotationExpired(
  q: { status: QuotationStatus; expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (q.status === "accepted" || q.status === "rejected" || q.status === "expired") return false;
  if (!q.expires_at) return false;
  return new Date(q.expires_at).getTime() < now.getTime();
}

export function transitionErrorMessage(from: QuotationStatus, to: QuotationStatus): string {
  if (from === "accepted") {
    return "La cotización ya fue aceptada: no puede cambiar de estado.";
  }
  return `No se puede pasar de "${STATUS_LABEL[from]}" a "${STATUS_LABEL[to]}".`;
}

/**
 * Cambia el estado de una cotización validando la transición en el cliente
 * (la base la vuelve a validar con `tg_quotation_status_guard`).
 * Las marcas temporales y el actor los sella la base de datos.
 */
export async function setQuotationStatus(
  id: string,
  from: QuotationStatus,
  to: QuotationStatus,
): Promise<void> {
  if (!canTransition(from, to)) throw new Error(transitionErrorMessage(from, to));
  const { error } = await supabase.from("quotations").update({ status: to }).eq("id", id);
  if (error) {
    if (error.hint === "invalid_status_transition") {
      throw new Error(transitionErrorMessage(from, to));
    }
    throw error;
  }
}

/** Expiración perezosa: marca como vencidas las cotizaciones cuya validez pasó. */
export async function expireDueQuotations(): Promise<number> {
  const { data, error } = await supabase.rpc("expire_due_quotations");
  if (error) return 0;
  return Number(data ?? 0);
}
