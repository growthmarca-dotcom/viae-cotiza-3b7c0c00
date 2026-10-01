import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLE_LABELS: Record<string, string> = {
  organization_owner: "Dueño de la agencia",
  organization_admin: "Administrador de la agencia",
  operations: "Operaciones",
  agent: "Agente",
  provider: "Proveedor",
  driver: "Conductor",
  viewer: "Solo lectura",
};

const DEFAULT_ORIGIN = "https://sales.viaetravel.com";

function safeOrigin(origin: string | undefined): string {
  if (!origin) return DEFAULT_ORIGIN;
  try {
    const u = new URL(origin);
    if (u.protocol === "https:" && /(^|\.)(viaetravel\.com|lovable\.app)$/.test(u.hostname)) return u.origin;
  } catch {
    /* ignore */
  }
  return DEFAULT_ORIGIN;
}

/**
 * Envía (o reenvía) el email de una invitación pendiente. Solo dueños/administradores
 * de la agencia o administradores globales: la RPC `mark_invitation_sent` lo valida.
 * El destinatario sale siempre de la invitación guardada, nunca del navegador.
 */
export const sendOrganizationInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ invitationId: z.string().uuid(), renew: z.boolean().default(false), origin: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv, error } = await supabase.rpc("mark_invitation_sent", {
      _invitation_id: data.invitationId,
      _renew: data.renew,
    });
    if (error || !inv) throw new Error(error?.message ?? "Invitación no encontrada");

    const [{ data: org }, { data: net }, { data: me }] = await Promise.all([
      supabase.from("organizations").select("trade_name").eq("id", inv.organization_id).maybeSingle(),
      inv.network_id
        ? supabase.from("agency_networks").select("name").eq("id", inv.network_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("organization-invitation", inv.email, {
      templateData: {
        inviterName: me?.full_name || (context.claims as { email?: string }).email || "Un integrante de ViaE",
        organizationName: org?.trade_name ?? "una agencia",
        networkName: (net as { name?: string } | null)?.name ?? null,
        roleLabel: ROLE_LABELS[inv.role] ?? inv.role,
        acceptUrl: `${safeOrigin(data.origin)}/invitacion/${inv.token}`,
        expiresLabel: new Date(inv.expires_at).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }),
      },
      idempotencyKey: `org-invite-${inv.id}-${inv.send_count}`,
    });
    return { sent: result.sent, reason: result.sent ? null : result.reason };
  });
