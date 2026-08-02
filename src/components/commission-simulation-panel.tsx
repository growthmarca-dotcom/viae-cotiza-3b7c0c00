import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calculator, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { formatMoney } from "@/lib/currency";
import {
  baseLabel,
  calcLabel,
  computeSimulationTotals,
  simulateCommission,
  type CommissionSimulation,
} from "@/lib/commissions";

/**
 * Simulador de comisiones (v1.9.4 Fase A) — SOLO LECTURA.
 * Muestra qué acuerdo y regla aplicarían a cada servicio de la reserva y qué
 * comisión resultaría. No genera devengo ni liquidaciones.
 */
export function CommissionSimulationPanel({ bookingId }: { bookingId: string }) {
  const { isAdmin, isOperations, account } = useAccount();
  const isProvider = (account?.roles.includes("provider") ?? false) && !isOperations;

  const { data: services = [] } = useQuery({
    queryKey: ["booking-services-min", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_services")
        .select("id, title, kind, record_status")
        .eq("booking_id", bookingId)
        .eq("record_status", "active")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !isProvider,
  });

  const ids = services.map((s) => s.id);
  const { data: sims = [], isLoading } = useQuery({
    queryKey: ["commission-simulation", bookingId, ids],
    queryFn: async () => {
      const rows = await Promise.all(ids.map((id) => simulateCommission(id)));
      return rows;
    },
    enabled: !isProvider && ids.length > 0,
  });

  if (isProvider) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <p className="text-sm">No tenés acceso a la simulación de comisiones.</p>
        </div>
      </section>
    );
  }

  const totals = computeSimulationTotals(sims as CommissionSimulation[]);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header>
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-gold" />
          <h2 className="font-display text-xl font-semibold">Simulación de comisiones</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cálculo estimado según los acuerdos comerciales vigentes. Es una vista de solo lectura:
          no genera comisiones devengadas ni liquidaciones.
        </p>
      </header>

      {/* Totales separados por moneda: nunca se mezclan monedas distintas. */}
      <div className="flex flex-wrap gap-3">
        {totals.byCurrency.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin comisiones estimables todavía.</p>
        )}
        {totals.byCurrency.map((t) => (
          <div key={t.currency} className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Estimado en {t.currency} · {t.count} servicio{t.count === 1 ? "" : "s"}
            </p>
            <p className="font-display text-lg font-semibold">
              {formatMoney(t.currency, t.commission)}
            </p>
          </div>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Calculando simulación…</p>}

      <ul className="space-y-3">
        {!isLoading && services.length === 0 && (
          <li className="text-sm text-muted-foreground">
            La reserva no tiene servicios cargados.
          </li>
        )}
        {(sims as CommissionSimulation[]).map((sim, i) => {
          const service = services[i];
          return (
            <li
              key={service?.id ?? i}
              className="rounded-xl border border-border p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{service?.title ?? "Servicio"}</p>
                {sim.commission_amount != null ? (
                  <p className="font-display text-base font-semibold">
                    {formatMoney(sim.currency ?? "ARS", sim.commission_amount)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin importe estimable</p>
                )}
              </div>

              {sim.has_agreement ? (
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>
                    Acuerdo: {sim.agreement_title ?? "Sin título"}
                    {sim.agreement_version ? ` · v${sim.agreement_version}` : ""}
                  </p>
                  <p>Regla: {sim.rule_label ?? "Condición general del acuerdo"}</p>
                  <p>
                    Base: {baseLabel(sim.base)} · {calcLabel(sim)}
                  </p>
                  {isAdmin && (
                    <p>
                      Base calculada:{" "}
                      {sim.base_amount != null
                        ? formatMoney(sim.sale_currency ?? "ARS", sim.base_amount)
                        : "—"}
                    </p>
                  )}
                  {!isAdmin && sim.restricted && (
                    <p className="flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Costos y márgenes no visibles para tu rol
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No hay un acuerdo comercial vigente que aplique a este servicio.
                </p>
              )}

              {(sim.warnings?.length ?? 0) > 0 && (
                <ul className="mt-2 space-y-1">
                  {sim.warnings!.map((w, k) => (
                    <li key={k} className="flex items-start gap-1 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
