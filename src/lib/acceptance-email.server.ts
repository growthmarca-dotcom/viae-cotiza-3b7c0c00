/**
 * v1.15 — Aviso interno por email cuando una propuesta pública es aceptada.
 *
 * Reglas:
 * - El destinatario se resuelve SIEMPRE desde `organizations.notification_email`
 *   de la organización propietaria de la propuesta. Nunca desde configuración global.
 * - Nunca bloquea la aceptación ni la conversión a reserva: cualquier problema
 *   se registra y se devuelve un motivo.
 * - Idempotente: `smart_quotes.acceptance_email_sent_at` se reclama antes de
 *   enviar, de modo que un mismo evento no genera dos envíos.
 * - No simula envíos: si no hay proveedor de email configurado en el proyecto,
 *   devuelve `provider_not_configured` y no marca la propuesta como enviada.
 */

/** Remitente de plataforma (único, no por agencia). */
export const PLATFORM_SENDER = "propuestas@notificaciones.viaetravel.com";

export type AcceptanceEmailResult = {
  sent: boolean;
  reason:
    | "sent"
    | "already_sent"
    | "no_organization"
    | "no_notification_email"
    | "provider_not_configured"
    | "send_failed"
    | "quote_not_found";
};

export type AcceptanceEmailPayload = {
  organizationName: string;
  to: string;
  fromName: string;
  from: string;
  subject: string;
  quoteReference: string;
  clientName: string | null;
  totalLabel: string | null;
  acceptedAt: string;
  bookingReference: string | null;
  internalUrl: string;
};

const INTERNAL_BASE_URL = "https://sales.viaetravel.com";

function money(amount: number | null, currency: string | null): string | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return `${currency || "USD"} ${Number(amount).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Envío real. Hoy el proyecto no tiene proveedor de email configurado
 * (falta verificar el dominio remitente de la plataforma), por lo que la
 * integración queda preparada y explícitamente inoperativa.
 */
async function deliver(_payload: AcceptanceEmailPayload): Promise<AcceptanceEmailResult> {
  return { sent: false, reason: "provider_not_configured" };
}

export async function notifySmartQuoteAccepted(
  smartQuoteId: string,
): Promise<AcceptanceEmailResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: sq, error } = await supabaseAdmin
    .from("smart_quotes")
    .select(
      "id, organization_id, client_id, opportunity_id, title, currency, total_amount, client_responded_at, acceptance_email_sent_at",
    )
    .eq("id", smartQuoteId)
    .maybeSingle();

  if (error || !sq) return { sent: false, reason: "quote_not_found" };
  if (sq.acceptance_email_sent_at) return { sent: false, reason: "already_sent" };
  if (!sq.organization_id) {
    console.warn("[acceptance-email] propuesta sin organización propietaria", { id: sq.id });
    return { sent: false, reason: "no_organization" };
  }

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, trade_name, notification_email")
    .eq("id", sq.organization_id)
    .maybeSingle();

  const to = org?.notification_email ?? null;
  if (!to) {
    console.warn(
      "[acceptance-email] no se envió el aviso: la organización no tiene notification_email configurado",
      { smart_quote_id: sq.id, organization_id: sq.organization_id },
    );
    return { sent: false, reason: "no_notification_email" };
  }

  let clientName: string | null = null;
  if (sq.client_id) {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("full_name")
      .eq("id", sq.client_id)
      .maybeSingle();
    clientName = (client?.full_name as string | null) ?? null;
  }

  // Reserva ya generada por el flujo existente (si corresponde).
  let bookingReference: string | null = null;
  if (sq.opportunity_id) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, booking_number")
      .eq("opportunity_id", sq.opportunity_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    bookingReference = (booking?.booking_number as string | null) ?? (booking?.id ?? null);
  }

  const organizationName = (org?.trade_name as string | null) ?? "Agencia";
  const acceptedAt = (sq.client_responded_at as string | null) ?? new Date().toISOString();

  const payload: AcceptanceEmailPayload = {
    organizationName,
    to,
    fromName: organizationName,
    from: PLATFORM_SENDER,
    subject: `Propuesta aceptada — ${sq.title}`,
    quoteReference: sq.id as string,
    clientName,
    totalLabel: money(sq.total_amount as number | null, sq.currency as string | null),
    acceptedAt,
    bookingReference,
    internalUrl: `${INTERNAL_BASE_URL}/smart-quotes/${sq.id}`,
  };

  // Idempotencia: se reclama la marca antes de enviar.
  const { data: claimed } = await supabaseAdmin
    .from("smart_quotes")
    .update({ acceptance_email_sent_at: new Date().toISOString() })
    .eq("id", sq.id)
    .is("acceptance_email_sent_at", null)
    .select("id")
    .maybeSingle();

  if (!claimed) return { sent: false, reason: "already_sent" };

  let result: AcceptanceEmailResult;
  try {
    result = await deliver(payload);
  } catch (e) {
    console.error("[acceptance-email] fallo de envío", e);
    result = { sent: false, reason: "send_failed" };
  }

  if (!result.sent) {
    // No quedó enviado: se libera la marca para poder reintentar más adelante.
    await supabaseAdmin
      .from("smart_quotes")
      .update({ acceptance_email_sent_at: null })
      .eq("id", sq.id);
    console.warn("[acceptance-email] aviso de aceptación no enviado", {
      smart_quote_id: sq.id,
      organization_id: sq.organization_id,
      reason: result.reason,
    });
  }

  return result;
}
