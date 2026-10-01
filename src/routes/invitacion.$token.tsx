import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptOrganizationInvitation,
  getInvitationByToken,
  INVITATION_STATE_LABELS,
  rejectOrganizationInvitation,
  type PublicInvitation,
} from "@/lib/organizationInvitations";
import { organizationMemberRoleLabel } from "@/lib/organizationMembers";

/**
 * Aceptación de una invitación por token. Muestra quién invita y a qué agencia/red,
 * pide ingresar o crear la cuenta con el MISMO email y valida la coincidencia
 * también en la base de datos.
 */
export const Route = createFileRoute("/invitacion/$token")({
  ssr: false,
  component: AcceptInvitationPage,
  head: () => ({
    meta: [
      { title: "Invitación a una agencia — ViaE Sales Hub" },
      { name: "description", content: "Aceptá tu invitación para sumarte a una agencia en ViaE Sales Hub." },
      { property: "og:title", content: "Invitación a una agencia — ViaE Sales Hub" },
      { property: "og:description", content: "Aceptá tu invitación para sumarte a una agencia en ViaE Sales Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inv, setInv] = useState<PublicInvitation | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data }, i] = await Promise.all([
          supabase.auth.getUser(),
          /^[0-9a-f-]{36}$/i.test(token) ? getInvitationByToken(token) : Promise.resolve(null),
        ]);
        setUserEmail(data.user?.email?.toLowerCase() ?? null);
        setInv(i);
      } catch {
        setInv(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const path = `/invitacion/${token}`;
  const wrongAccount = inv && userEmail && userEmail !== inv.email.toLowerCase();

  async function act(kind: "accept" | "reject") {
    setBusy(true);
    try {
      if (kind === "accept") await acceptOrganizationInvitation(token);
      else await rejectOrganizationInvitation(token);
      setResult(kind === "accept" ? "accepted" : "rejected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la acción");
      const fresh = await getInvitationByToken(token).catch(() => null);
      if (fresh) setInv(fresh);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-4 py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Invitación a una agencia</h1>

        {loading ? (
          <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-muted-foreground" />
        ) : !inv ? (
          <p className="mt-4 text-sm text-muted-foreground">Este enlace de invitación no es válido.</p>
        ) : result === "accepted" ? (
          <>
            <CheckCircle2 className="mx-auto mt-6 h-8 w-8 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Ya formás parte de {inv.organization_name}
              {inv.network_name ? ` (red ${inv.network_name})` : ""}.
            </p>
            <Button className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>Ir al panel</Button>
          </>
        ) : result === "rejected" ? (
          <>
            <XCircle className="mx-auto mt-6 h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Rechazaste la invitación.</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              <strong className="text-foreground">{inv.inviter_name ?? "Un integrante de ViaE"}</strong> te invitó a
              sumarte a <strong className="text-foreground">{inv.organization_name}</strong>
              {inv.network_name ? <> de la red <strong className="text-foreground">{inv.network_name}</strong></> : null} como{" "}
              {organizationMemberRoleLabel(inv.role)}.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Invitación para {inv.email}</p>

            {inv.state !== "pending" ? (
              <p className="mt-6 rounded-xl bg-secondary/60 p-3 text-sm">
                Esta invitación está {INVITATION_STATE_LABELS[inv.state].toLowerCase()} y ya no puede aceptarse.
                {inv.state === "expired" ? " Pedí a la agencia que te la reenvíe." : ""}
              </p>
            ) : !userEmail ? (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted-foreground">Ingresá o creá tu cuenta con <strong>{inv.email}</strong> para aceptar.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Link to="/auth" search={{ mode: "signin", email: inv.email, redirect: path }}>
                    <Button>Ya tengo cuenta</Button>
                  </Link>
                  <Link to="/auth" search={{ mode: "signup", email: inv.email, redirect: path }}>
                    <Button variant="outline">Crear cuenta</Button>
                  </Link>
                </div>
              </div>
            ) : wrongAccount ? (
              <div className="mt-6 space-y-3">
                <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  Estás conectado como {userEmail}. Esta invitación es para {inv.email}.
                </p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUserEmail(null);
                  }}
                >
                  Cerrar sesión y cambiar de cuenta
                </Button>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button disabled={busy} onClick={() => act("accept")}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Aceptar invitación
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => act("reject")}>Rechazar</Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
