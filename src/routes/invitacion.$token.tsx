import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { acceptOrganizationInvitation } from "@/lib/organizationInvitations";

/**
 * Intervención 4 — Membresías.
 * Aceptación de una invitación por token. Requiere sesión: si el usuario no
 * está autenticado se lo invita a ingresar y luego volver a este enlace.
 */
export const Route = createFileRoute("/invitacion/$token")({
  ssr: false,
  component: AcceptInvitationPage,
  head: () => ({
    meta: [
      { title: "Invitación a una organización — ViaE Sales Hub" },
      {
        name: "description",
        content: "Aceptá tu invitación para acceder a la organización en ViaE Sales Hub.",
      },
      { property: "og:title", content: "Invitación a una organización — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Aceptá tu invitación para acceder a la organización en ViaE Sales Hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setSignedIn(Boolean(data.user));
      setChecking(false);
    })();
  }, []);

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-4 py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Invitación a una organización</h1>

        {checking ? (
          <div className="mt-6 grid place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : done ? (
          <>
            <CheckCircle2 className="mx-auto mt-6 h-8 w-8 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Ya tenés acceso a la organización.
            </p>
            <Button className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
              Ir al panel
            </Button>
          </>
        ) : signedIn ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Aceptá la invitación para sumarte a la organización con el rol asignado.
            </p>
            <Button
              className="mt-6"
              disabled={accepting}
              onClick={async () => {
                setAccepting(true);
                try {
                  await acceptOrganizationInvitation(token);
                  setDone(true);
                  toast.success("Invitación aceptada");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "No se pudo aceptar la invitación");
                } finally {
                  setAccepting(false);
                }
              }}
            >
              {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aceptar invitación
            </Button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Ingresá con tu cuenta y volvé a abrir este enlace para aceptar la invitación.
            </p>
            <Link to="/auth" className="mt-6 inline-block">
              <Button>Ingresar</Button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
