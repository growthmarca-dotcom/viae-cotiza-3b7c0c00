import { createFileRoute } from "@tanstack/react-router";
import { Users, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
  head: () => ({
    meta: [
      { title: "Clientes — ViaE" },
      { name: "description", content: "Gestiona tus clientes." },
    ],
  }),
});

function ClientsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-semibold sm:text-4xl">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra la información de tus viajeros.
          </p>
        </div>
        <Button className="shrink-0" disabled>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo cliente
        </Button>
      </header>

      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
          <Users className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">Aún no hay clientes</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Podrás registrar clientes y asociarlos a tus cotizaciones.
        </p>
      </div>
    </div>
  );
}
