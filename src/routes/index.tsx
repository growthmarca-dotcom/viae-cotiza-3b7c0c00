import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, FileText, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Compass className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight">
              ViaE <span className="text-gold">Cotizaciones</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost">Iniciar sesión</Button>
            </Link>
            <Link to="/auth" search={{ mode: "signup" as const }}>
              <Button>Crear cuenta</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            Para agentes de viajes
          </span>
          <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl">
            Cotizaciones de viaje{" "}
            <span className="italic text-primary">elegantes</span>,
            <br />
            listas para compartir.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Crea propuestas profesionales para tus clientes en minutos y compártelas con
            un enlace único. Simple, moderno, hecho para viajar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/dashboard">
              <Button size="lg">Comenzar ahora</Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">
                Ya tengo una cuenta
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: FileText,
              title: "Cotizaciones al instante",
              body: "Plantillas limpias para armar propuestas de viaje profesionales.",
            },
            {
              icon: Share2,
              title: "Enlace único",
              body: "Comparte cada cotización con un link privado para tu cliente.",
            },
            {
              icon: Sparkles,
              title: "Todo en un lugar",
              body: "Clientes, cotizaciones y estadísticas en un solo panel.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ViaE Cotizaciones
      </footer>
    </div>
  );
}
