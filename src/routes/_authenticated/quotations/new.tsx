import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/quotations/new")({
  component: NewQuotationPage,
  head: () => ({
    meta: [
      { title: "Nueva cotización — ViaE" },
      { name: "description", content: "Crea una nueva cotización de viaje." },
    ],
  }),
});

function NewQuotationPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        to="/quotations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a cotizaciones
      </Link>

      <header>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">
          Nueva cotización
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arma una propuesta de viaje para tu cliente.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-gold/20 text-gold-foreground">
          ✈️
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold">Próximamente</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          El formulario para crear cotizaciones se habilitará en el próximo paso.
          Podrás ingresar destino, fechas, cliente, itinerario y compartir un enlace
          único.
        </p>
        <div className="mt-6 flex gap-2">
          <Link to="/dashboard">
            <Button variant="outline">Ir al dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
