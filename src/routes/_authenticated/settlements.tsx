import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/currency";
import { useAccount } from "@/hooks/use-account";
import {
  SETTLEMENT_STATUS_CLASSES,
  beneficiaryTypeLabel,
  fetchBeneficiaryNames,
  generateSettlements,
  listSettlements,
  periodLabel,
  settlementStatusLabel,
  settlementTotals,
  type BeneficiaryType,
  type SettlementStatus,
} from "@/lib/settlements";

export const Route = createFileRoute("/_authenticated/settlements")({
  component: SettlementsPage,
  head: () => ({
    meta: [
      { title: "Liquidaciones de comisiones — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Núcleo administrativo de liquidaciones: comisiones aprobadas elegibles, agrupadas por beneficiario, moneda y período.",
      },
      { property: "og:title", content: "Liquidaciones de comisiones — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Generación y revisión de liquidaciones de comisiones aprobadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/**
 * Bandeja de liquidaciones. La generación es una RPC administrativa: agrupa
 * comisiones aprobadas y elegibles por beneficiario, moneda y período, sin
 * recalcular importes ni tocar el motor de comisiones.
 */
function SettlementsPage() {
  const { isAdmin } = useAccount();
  const qc = useQueryClient();
  const [status, setStatus] = useState<SettlementStatus | "all">("all");
  const [currency, setCurrency] = useState<string>("all");
  const [beneficiaryType, setBeneficiaryType] = useState<BeneficiaryType | "all">("all");
  const [asOf, setAsOf] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["settlements", status, currency, beneficiaryType],
    queryFn: () => listSettlements({ status, currency, beneficiaryType }),
  });

  const { data: names = {} } = useQuery({
    queryKey: ["settlement-beneficiaries", rows.map((r) => r.beneficiary_id).join(",")],
    queryFn: () => fetchBeneficiaryNames(rows),
    enabled: rows.length > 0,
  });

  const generate = useMutation({
    mutationFn: () => generateSettlements(asOf || undefined),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(
          res.reason === "forbidden"
            ? "Sólo un administrador puede generar liquidaciones."
            : "No se pudieron generar las liquidaciones.",
        );
        return;
      }
      toast.success(
        `Liquidaciones nuevas: ${res.settlements_created ?? 0} · Comisiones incorporadas: ${res.items_created ?? 0}`,
      );
      void qc.invalidateQueries({ queryKey: ["settlements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = settlementTotals(rows);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Comisiones · Administración</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Liquidaciones de comisiones
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Se agrupan comisiones <strong>aprobadas</strong> cuyo servicio ya finalizó y cuyo plazo del
          acuerdo se cumplió. Cada liquidación tiene un único beneficiario, moneda y período. El
          registro del pago se habilita en la próxima fase.
        </p>
      </header>

      {isAdmin && (
        <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="as-of">Calcular al</Label>
            <Input
              id="as-of"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Generar liquidaciones
          </Button>
          <p className="text-xs text-muted-foreground">
            Se puede ejecutar varias veces: nunca duplica una comisión ya incluida.
          </p>
        </section>
      )}

      <section className="flex flex-wrap gap-3">
        {totals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay liquidaciones registradas.</p>
        ) : (
          totals.map((t) => (
            <div key={t.currency} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <span className="text-sm text-muted-foreground">
                Pendiente de pago en {t.currency}
              </span>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
                {formatMoney(t.currency, t.total)}
              </p>
              <p className="text-xs text-muted-foreground">{t.count} liquidación(es)</p>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as SettlementStatus | "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="pending_review">En revisión</SelectItem>
            <SelectItem value="approved">Aprobada</SelectItem>
            <SelectItem value="settled">Liquidada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Moneda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las monedas</SelectItem>
            <SelectItem value="ARS">ARS</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={beneficiaryType}
          onValueChange={(v) => setBeneficiaryType(v as BeneficiaryType | "all")}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Beneficiario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los beneficiarios</SelectItem>
            <SelectItem value="organization">Organizaciones</SelectItem>
            <SelectItem value="agent">Agentes</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Wallet className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No hay liquidaciones con estos filtros. Generá liquidaciones cuando existan comisiones
            aprobadas y elegibles.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const st = r.status as SettlementStatus;
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <Link to="/settlements/$id" params={{ id: r.id }} className="underline">
                        {names[r.beneficiary_id] ?? beneficiaryTypeLabel(r.beneficiary_type)}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {beneficiaryTypeLabel(r.beneficiary_type)} ·{" "}
                      {periodLabel(r.period_start, r.period_end)} · {r.commission_count} comisión(es)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${SETTLEMENT_STATUS_CLASSES[st]}`}
                    >
                      {settlementStatusLabel(st)}
                    </span>
                    <p className="font-display text-base font-semibold">
                      {formatMoney(r.currency, Number(r.total_commission_amount ?? 0))}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
