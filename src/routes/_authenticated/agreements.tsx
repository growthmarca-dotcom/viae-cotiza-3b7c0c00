import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-account";
import { AgreementsPanel } from "@/components/agreements-panel";
import {
  AGREEMENT_STATUSES,
  AGREEMENT_TYPES,
  computeAgreementStats,
  listAgreements,
  type AgreementStatus,
  type AgreementType,
} from "@/lib/agreements";

export const Route = createFileRoute("/_authenticated/agreements")({
  component: AgreementsPage,
  head: () => ({
    meta: [
      { title: "Acuerdos comerciales — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Registro central de condiciones comerciales de ViaE con organizaciones proveedoras, agencias asociadas, partners y agentes.",
      },
      { property: "og:title", content: "Acuerdos comerciales — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Comisiones, tarifas netas y vigencias pactadas con cada organización o agente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AgreementsPage() {
  const { isAdmin, isOperations, isLoading } = useAccount();
  const [type, setType] = useState<AgreementType | "all">("all");
  const [status, setStatus] = useState<AgreementStatus | "all">("all");

  const { data: all = [] } = useQuery({
    queryKey: ["agreements-all", { type, status }],
    queryFn: () => listAgreements({ type, status, includeArchived: status !== "all" }),
  });

  const stats = useMemo(() => computeAgreementStats(all), [all]);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Condiciones comerciales del ecosistema ViaE</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Acuerdos comerciales
        </h1>
      </header>

      {!isAdmin && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4" />
          <p>
            {isOperations
              ? "Tenés acceso de consulta. La creación y edición de acuerdos corresponde a Administración."
              : "Sólo podés consultar los acuerdos vinculados a tu perfil comercial."}
          </p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Acuerdos", value: stats.total },
          { label: "Vigentes hoy", value: stats.current },
          { label: "Con organización", value: stats.withOrganizations },
          { label: "Con agentes", value: stats.withAgents },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2">
        <Select value={type} onValueChange={(v) => setType(v as AgreementType | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo de acuerdo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {AGREEMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as AgreementStatus | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {AGREEMENT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <AgreementsPanel canManage={isAdmin} />
    </div>
  );
}
