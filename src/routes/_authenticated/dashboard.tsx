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
import { listOpportunities, OPPORTUNITY_STAGES } from "@/lib/opportunities";
import { formatMoney, toAnalysisCurrency } from "@/lib/currency";
import { useAnalysisCurrency } from "@/hooks/use-analysis-currency";
import { useAccount } from "@/hooks/use-account";
import { listTransportServices } from "@/lib/transport";
import { computeTransportEconomics } from "@/lib/transport-economics";
import { computeLeadStats, countActiveLeadsByAgent, listLeads } from "@/lib/leads";
import { agentFullName, listAgents } from "@/lib/agents";
import { listBookings } from "@/lib/bookings";
import { computeOperationsStats, listAllBookingServices } from "@/lib/operations";

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

      <LeadsSection />

      <PipelineSection />

      <TransportEconomicsSection />

      <OperationsSection />








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
/** Gestión comercial de leads (v1.7). */
/** Indicadores de la central operativa (v1.8). Solo Admin y Operaciones. */
function OperationsSection() {
  const { isOperations } = useAccount();

  const { data } = useQuery({
    queryKey: ["operations-stats"],
    enabled: isOperations,
    queryFn: async () => {
      const [bookings, services, checklist, incidents] = await Promise.all([
        listBookings(),
        listAllBookingServices(),
        listChecklistByBooking(),
        listAllIncidents(),
      ]);
      return {
        ...computeOperationsStats(bookings, services),
        ...computeChecklistIncidentStats(checklist, incidents),
      };
    },
  });

  if (!isOperations) return null;

  const cards = [
    { label: "Reservas sin operar", value: String(data?.pending ?? 0) },
    { label: "Salidas próximas (7 días)", value: String(data?.upcoming ?? 0) },
    { label: "Servicios sin proveedor", value: String(data?.unassignedServices ?? 0) },
    { label: "Reservas con incidencias", value: String(data?.bookingsWithIncidents ?? 0) },
    { label: "Incidencias abiertas", value: String(data?.openIncidents ?? 0) },
    { label: "Incidencias urgentes", value: String(data?.urgentIncidents ?? 0) },
    { label: "Listas para viajar", value: String(data?.readyToTravel ?? 0) },
    { label: "Avance operativo promedio", value: `${data?.averageProgress ?? 0} %` },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Central operativa</h2>
        <Button asChild size="sm" variant="outline">
          <Link to="/operations">Ver bandeja</Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeadsSection() {
  const { data } = useQuery({
    queryKey: ["lead-stats"],
    queryFn: async () => {
      const leads = await listLeads("active");
      const agents = await listAgents();
      const byAgent = countActiveLeadsByAgent(leads);
      const top = agents
        .map((a) => ({ name: agentFullName(a), value: byAgent[a.id] ?? 0 }))
        .filter((r) => r.value > 0)
        .sort((x, y) => y.value - x.value)
        .slice(0, 5);
      return { stats: computeLeadStats(leads), top };
    },
  });

  const s = data?.stats;
  const cards = [
    { label: "Consultas recibidas", value: String(s?.total ?? 0) },
    { label: "Sin asignar", value: String(s?.unassigned ?? 0) },
    { label: "Asignadas", value: String(s?.assigned ?? 0) },
    { label: "Contactadas", value: String(s?.contacted ?? 0) },
    { label: "Ganadas", value: String(s?.won ?? 0) },
    { label: "Conversión de leads", value: `${s?.conversion ?? 0}%` },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Gestión de consultas</h2>
        <Link to="/leads" className="text-sm font-medium text-primary hover:underline">
          Ir a la bandeja
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>
      {(data?.top ?? []).length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 font-display text-lg font-semibold">Leads activos por agente</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(data?.top ?? []).map((r) => (
              <div key={r.name} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{r.name}</span>
                <span className="font-medium">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** Economía del transporte (v1.6) en la moneda de análisis configurada. */
function TransportEconomicsSection() {

  const analysisCurrency = useAnalysisCurrency();
  const { isAdmin } = useAccount();

  const { data } = useQuery({
    queryKey: ["transport-economics", analysisCurrency],
    queryFn: async () => {
      const services = await listTransportServices();
      return computeTransportEconomics(services, analysisCurrency);
    },
  });

  const cards = [
    {
      label: `Ventas de transporte (${analysisCurrency})`,
      value: formatMoney(analysisCurrency, data?.sales ?? 0),
    },
    ...(isAdmin
      ? [
          {
            label: `Costos operativos (${analysisCurrency})`,
            value: formatMoney(analysisCurrency, data?.costs ?? 0),
          },
          {
            label: "Margen bruto ViaE",
            value: `${formatMoney(analysisCurrency, data?.gross ?? 0)}${
              data?.marginPercent != null ? ` · ${data.marginPercent}%` : ""
            }`,
          },
        ]
      : []),
    { label: "Servicios finalizados", value: String(data?.servicesDone ?? 0) },
    {
      label: "Cobros pendientes",
      value: `${data?.pendingCollection ?? 0} · ${formatMoney(analysisCurrency, data?.pendingCollectionAmount ?? 0)}`,
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Economía del transporte</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>
      {(data?.excluded ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground">
          {data?.excluded} servicio(s) sin tipo de cambio quedaron fuera de los totales.
        </p>
      )}
    </section>
  );
}


/** Indicadores del pipeline comercial (oportunidades). */
function PipelineSection() {
  const analysisCurrency = useAnalysisCurrency();

  const { data } = useQuery({
    queryKey: ["opportunity-stats", analysisCurrency],
    queryFn: async () => {
      const rows = await listOpportunities();

      // Tipo de cambio de la cotización vinculada, para no mezclar monedas.
      const quotationIds = rows.map((r) => r.quotation_id).filter(Boolean) as string[];
      const rates = new Map<string, number | null>();
      if (quotationIds.length) {
        const { data: qs } = await supabase
          .from("quotations")
          .select("id, exchange_rate")
          .in("id", quotationIds);
        for (const q of qs ?? []) rates.set(q.id, q.exchange_rate);
      }

      const converted = rows.map((r) =>
        toAnalysisCurrency(
          r.estimated_value,
          r.currency,
          analysisCurrency,
          r.quotation_id ? rates.get(r.quotation_id) : null,
        ),
      );

      const byStage = OPPORTUNITY_STAGES.map((s) => ({
        label: s.label,
        value: rows.filter((r) => r.stage === s.value).length,
      }));

      return {
        count: rows.length,
        totalValue: converted.reduce((acc: number, v) => acc + (v ?? 0), 0),
        excluded: converted.filter((v) => v == null).length,
        quoted: rows.filter((r) => r.stage === "quoted").length,
        booked: rows.filter((r) => r.stage === "booked").length,
        lost: rows.filter((r) => r.stage === "lost" || r.stage === "cancelled").length,
        byStage,
      };
    },
  });

  const cards = [
    { label: "Oportunidades", value: String(data?.count ?? 0) },
    {
      label: `Valor total estimado (${analysisCurrency})`,
      value: formatMoney(analysisCurrency, data?.totalValue ?? 0),
    },
    { label: "Cotizaciones enviadas", value: String(data?.quoted ?? 0) },
    { label: "Reservas confirmadas", value: String(data?.booked ?? 0) },
    { label: "Ventas perdidas", value: String(data?.lost ?? 0) },
  ];

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Pipeline comercial</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>
      {(data?.excluded ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground">
          {data?.excluded} oportunidad(es) quedaron fuera del total porque su moneda no es
          convertible a {analysisCurrency}.
        </p>
      )}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-display text-lg font-semibold">Oportunidades por estado</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(data?.byStage ?? []).map((s) => (
            <div key={s.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
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
