import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlusCircle,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — ViaE Sales Hub" },
      { name: "description", content: "Panel de control de tus cotizaciones." },
    ],
  }),
});

type Stats = {
  total: number;
  accepted: number;
  pending: number;
  expired: number;
};

function Dashboard() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["quotation-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("quotations").select("status");
      const rows = data ?? [];
      return {
        total: rows.length,
        accepted: rows.filter((r) => r.status === "accepted").length,
        pending: rows.filter((r) => r.status === "pending" || r.status === "sent")
          .length,
        expired: rows.filter((r) => r.status === "expired").length,
      };
    },
  });

  const cards = [
    {
      label: "Cotizaciones creadas",
      value: stats?.total ?? 0,
      icon: FileText,
      tint: "bg-secondary text-primary",
    },
    {
      label: "Aceptadas",
      value: stats?.accepted ?? 0,
      icon: CheckCircle2,
      tint: "bg-primary/10 text-primary",
    },
    {
      label: "Pendientes",
      value: stats?.pending ?? 0,
      icon: Clock,
      tint: "bg-gold/20 text-gold-foreground",
    },
    {
      label: "Vencidas",
      value: stats?.expired ?? 0,
      icon: AlertTriangle,
      tint: "bg-destructive/10 text-destructive",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Bienvenido{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </p>
          <h1 className="mt-1 truncate font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Dashboard
          </h1>
        </div>
        <Link to="/quotations/new">
          <Button size="lg" className="shrink-0">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva cotización
          </Button>
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tint }) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className={`grid h-9 w-9 place-items-center rounded-lg ${tint}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-4 font-display text-4xl font-semibold tracking-tight">
              {value}
            </p>
          </div>
        ))}
      </section>

      <PipelineSection />



      <section className="grid gap-4 md:grid-cols-3">
        <QuickCard
          to="/quotations/new"
          title="Crear cotización"
          body="Arma una propuesta profesional en minutos."
        />
        <QuickCard
          to="/quotations"
          title="Ver cotizaciones"
          body="Revisa el estado de todas tus propuestas."
        />
        <QuickCard
          to="/clients"
          title="Clientes"
          body="Administra la información de tus clientes."
        />
      </section>
    </div>
  );
}

function QuickCard({ to, title, body }: { to: string; title: string; body: string }) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary"
    >
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
        Ir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
