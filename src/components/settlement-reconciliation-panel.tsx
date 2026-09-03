import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/currency";
import {
  RECONCILIATION_CLASSES,
  RECONCILIATION_ISSUE_LABELS,
  RECONCILIATION_LABELS,
  getPayableAmount,
  getSettlementPayment,
  reconcileSettlementPayment,
  settlementReason,
  type ReconciliationStatus,
  type Settlement,
} from "@/lib/settlements";

/**
 * Conciliación interna (C1.3). No es conciliación bancaria: sólo comprueba que
 * liquidación → factura aprobada → pago registrado sean coherentes.
 *
 * Una discrepancia NUNCA se arregla editando el pago: se deja registrada y se
 * corrige con un ajuste.
 */
export function SettlementReconciliationPanel({
  settlement,
  isAdmin,
}: {
  settlement: Settlement;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");

  const { data: payment } = useQuery({
    queryKey: ["settlement-payment", settlement.id],
    queryFn: () => getSettlementPayment(settlement.id),
  });

  const { data: payable = 0 } = useQuery({
    queryKey: ["settlement-payable", settlement.id],
    queryFn: () => getPayableAmount(settlement.id),
  });

  const reconcile = useMutation({
    mutationFn: async (status: ReconciliationStatus) => {
      const res = await reconcileSettlementPayment(settlement.id, status, notes);
      if (!res.ok) {
        const issues = (res.issues ?? [])
          .map((i) => RECONCILIATION_ISSUE_LABELS[i] ?? i)
          .join(" ");
        throw new Error(`${settlementReason(res.reason)} ${issues}`.trim());
      }
      return res;
    },
    onSuccess: (res) => {
      toast.success(
        res.reconciliation_status === "discrepancy"
          ? "Discrepancia registrada. Corregila con un ajuste."
          : "Conciliación actualizada.",
      );
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["settlement-payment", settlement.id] });
      void qc.invalidateQueries({ queryKey: ["settlement-adjustment-history", settlement.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!payment) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Conciliación</h2>
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          La conciliación se habilita cuando hay un pago registrado.
        </p>
      </section>
    );
  }

  const rs = (payment.reconciliation_status ?? "pending") as ReconciliationStatus;
  const coherent =
    Math.round(Number(payment.amount) * 100) === Math.round(payable * 100) &&
    payment.currency === settlement.currency;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Conciliación</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${RECONCILIATION_CLASSES[rs]}`}>
          {RECONCILIATION_LABELS[rs]}
        </span>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Importe final de la liquidación</dt>
            <dd className="font-display text-base font-semibold">
              {formatMoney(settlement.currency, payable)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pago registrado</dt>
            <dd className="font-display text-base font-semibold">
              {formatMoney(payment.currency, Number(payment.amount))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fecha y referencia</dt>
            <dd>
              {payment.payment_date}
              {payment.payment_reference ? ` · ${payment.payment_reference}` : ""}
            </dd>
          </div>
        </dl>

        <p className="flex items-center gap-2 text-sm">
          {coherent ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-gold" />
              <span className="text-muted-foreground">
                Beneficiario, moneda e importe coinciden con la liquidación.
              </span>
            </>
          ) : (
            <>
              <TriangleAlert className="h-4 w-4 text-destructive" />
              <span className="text-destructive">
                Hay una diferencia entre el pago y el importe final: registrá la discrepancia y
                corregila con un ajuste.
              </span>
            </>
          )}
        </p>

        {payment.reconciliation_notes && (
          <p className="text-sm text-muted-foreground">{payment.reconciliation_notes}</p>
        )}
        {payment.reconciled_at && (
          <p className="text-xs text-muted-foreground">
            Última conciliación:{" "}
            {new Date(payment.reconciled_at).toLocaleString("es-AR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        )}

        {isAdmin && (
          <div className="space-y-3 border-t border-border pt-4">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas de conciliación (obligatorias para registrar una discrepancia)"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => reconcile.mutate("reconciled")}
                disabled={reconcile.isPending || rs === "reconciled"}
              >
                {reconcile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Marcar conciliada
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => reconcile.mutate("discrepancy")}
                disabled={reconcile.isPending || !notes.trim() || rs === "discrepancy"}
              >
                Registrar discrepancia
              </Button>
              {rs !== "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => reconcile.mutate("pending")}
                  disabled={reconcile.isPending}
                >
                  Volver a pendiente
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              El pago registrado es histórico: la conciliación nunca lo modifica.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
