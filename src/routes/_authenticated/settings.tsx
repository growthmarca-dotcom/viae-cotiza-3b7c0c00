import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Configuración — ViaE" },
      { name: "description", content: "Configura tu cuenta y agencia." },
    ],
  }),
});

function SettingsPage() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").maybeSingle();
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos de tu agencia y preferencias de la cuenta.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Perfil de la agencia</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta información aparecerá en las cotizaciones que compartas.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input defaultValue={profile?.full_name ?? ""} placeholder="Tu nombre" disabled />
          </div>
          <div className="space-y-2">
            <Label>Agencia</Label>
            <Input
              defaultValue={profile?.agency_name ?? ""}
              placeholder="Nombre de tu agencia"
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input defaultValue={profile?.phone ?? ""} placeholder="+52..." disabled />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button disabled>Guardar cambios</Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          La edición se habilitará próximamente.
        </p>
      </section>
    </div>
  );
}
