import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/quotations/")({
  component: QuotationsPage,
  head: () => ({
    meta: [
      { title: "Cotizaciones — ViaE" },
      { name: "description", content: "Todas tus cotizaciones en un solo lugar." },
    ],
  }),
});

function QuotationsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-semibold sm:text-4xl">
            Cotizaciones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra tus propuestas y su estado.
          </p>
        </div>
        <Link to="/quotations/new">
          <Button className="shrink-0">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva
          </Button>
        </Link>
      </header>

      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
          <FileText className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">
          Aún no tienes cotizaciones
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Crea tu primera cotización y compártela con tu cliente por un enlace único.
        </p>
        <Link to="/quotations/new" className="mt-6 inline-block">
          <Button>Crear cotización</Button>
        </Link>
      </div>
    </div>
  );
}
