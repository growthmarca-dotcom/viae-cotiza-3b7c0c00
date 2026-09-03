import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/currency";
import { useAccount } from "@/hooks/use-account";
import { baseLabel } from "@/lib/commissions";
import { SettlementInvoicePanel } from "@/components/settlement-invoice-panel";
import { SettlementPaymentPanel } from "@/components/settlement-payment-panel";
import { SettlementReconciliationPanel } from "@/components/settlement-reconciliation-panel";
import { SettlementAdjustmentsPanel } from "@/components/settlement-adjustments-panel";
import {
  SETTLEMENT_STATUS_CLASSES,
  SETTLEMENT_STATUS_HELP,
  beneficiaryTypeLabel,
  fetchBeneficiaryNames,
  getSettlement,
  listSettlementHistory,
  listSettlementItems,
  periodLabel,
  setSettlementNotes,
  setSettlementStatus,
  settlementStatusLabel,
  type SettlementStatus,
} from "@/lib/settlements";

export const Route = createFileRoute("/_authenticated/settlements_/$id")({
  component: SettlementDetailPage,
  head: () => ({
    meta: [
      { title: "Detalle de liquidación — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Detalle de una liquidación de comisiones: comisiones incluidas, importes por moneda, estado e historial administrativo.",
      },
      { property: "og:title", content: "Detalle de liquidación — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Comisiones incluidas, estado e historial de la liquidación.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const REASONS: Record<string, string> = {
  forbidden: "Sólo un administrador puede cambiar el estado de una liquidación.",
  invalid_transition: "Esa transición de estado no está permitida.",
  settlement_payment_not_available:
    "El registro del pago todavía no está disponible: se habilita en la próxima fase.",
  not_found: "La liquidación no existe.",
};

/**
 * Detalle administrativo. Las comisiones incluidas se muestran con el importe
 * sellado al momento de la liquidación; nada se recalcula acá.
 */
function SettlementDetailPage() {
  const { id } = Route.useParams();
  const { isAdmin } = useAccount();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [notes, setNotes] = useState<string | null>(null);

  const { data: settlement, isLoading } = useQuery({
    queryKey: ["settlement", id],
    queryFn: () => getSettlement(id),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["settlement-items", id],
    queryFn: () => listSettlementItems(id),
  });
  const { data: history = [] } = useQuery({
    queryKey: ["settlement-history", id],
    queryFn: () => listSettlementHistory(id),
  });
  const { data: names = {} } = useQuery({
    queryKey: ["settlement-beneficiary", settlement?.beneficiary_id],
    queryFn: () => fetchBeneficiaryNames(settlement ? [settlement] : []),
    enabled: !!settlement,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["settlement", id] });
    void qc.invalidateQueries({ queryKey: ["settlement-history", id] });
    void qc.invalidateQueries({ queryKey: ["settlements"] });
  };

  const transition = useMutation({
    mutationFn: (to: Exclude<SettlementStatus, "settled" | "invoice_review" | "ready_for_payment">) =>
      setSettlementStatus(id, to, comment),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(REASONS[res.reason ?? ""] ?? "No se pudo cambiar el estado.");
        return;
      }
      toast.success("Estado actualizado.");
      setComment("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: () => setSettlementNotes(id, notes ?? ""),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(REASONS[res.reason ?? ""] ?? "No se pudieron guardar las notas.");
        return;
      }
      toast.success("Notas guardadas.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">No encontramos esta liquidación.</p>
        <Button asChild variant="outline">
          <Link to="/settlements">Volver a liquidaciones</Link>
        </Button>
      </div>
    );
  }

  const st = settlement.status as SettlementStatus;
  const locked = st !== "draft" && st !== "pending_review";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        to="/settlements"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Liquidaciones
      </Link>

      <header className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {beneficiaryTypeLabel(settlement.beneficiary_type)} ·{" "}
              {periodLabel(settlement.period_start, settlement.period_end)}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {names[settlement.beneficiary_id] ?? "Beneficiario"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{SETTLEMENT_STATUS_HELP[st]}</p>
          </div>
          <div className="text-right">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${SETTLEMENT_STATUS_CLASSES[st]}`}
            >
              {settlementStatusLabel(st)}
            </span>
            <p className="mt-3 font-display text-2xl font-semibold tracking-tight">
              {formatMoney(settlement.currency, Number(settlement.total_commission_amount ?? 0))}
            </p>
            <p className="text-xs text-muted-foreground">
              {settlement.commission_count} comisión(es) en {settlement.currency}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <Textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comentario para el historial (opcional)"
            />
            <div className="flex flex-wrap gap-2">
              {st === "draft" && (
                <Button
                  onClick={() => transition.mutate("pending_review")}
                  disabled={transition.isPending}
                >
                  Enviar a revisión
                </Button>
              )}
              {st === "pending_review" && (
                <>
                  <Button
                    onClick={() => transition.mutate("approved")}
                    disabled={transition.isPending}
                  >
                    Aprobar liquidación
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => transition.mutate("draft")}
                    disabled={transition.isPending}
                  >
                    Volver a borrador
                  </Button>
                </>
              )}
              {st === "approved" && (
                <>
                  <Button
                    onClick={() => transition.mutate("invoice_pending")}
                    disabled={transition.isPending}
                  >
                    Solicitar factura
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => transition.mutate("pending_review")}
                    disabled={transition.isPending}
                  >
                    Reabrir revisión
                  </Button>
                </>
              )}
              {st === "invoice_pending" && (
                <Button
                  variant="outline"
                  onClick={() => transition.mutate("approved")}
                  disabled={transition.isPending}
                >
                  Volver a aprobada
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              La liquidación pasa a lista para pago sólo cuando se aprueba la factura, y a pagada
              sólo al registrar el pago completo.
            </p>
          </div>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Comisiones incluidas</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta liquidación no tiene comisiones.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {it.commission?.booking?.booking_number && it.commission.booking_id ? (
                      <Link
                        to="/bookings/$id"
                        params={{ id: it.commission.booking_id }}
                        className="underline"
                      >
                        {it.commission.booking.booking_number}
                      </Link>
                    ) : (
                      "Reserva"
                    )}
                    {it.commission?.service?.title ? ` · ${it.commission.service.title}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {baseLabel(it.commission?.base)} · Servicio: {it.checkout_date ?? "—"} ·
                    Liquidable desde: {it.eligible_on ?? "—"}
                  </p>
                </div>
                <p className="font-display text-sm font-semibold">
                  {formatMoney(it.currency, Number(it.commission_amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SettlementInvoicePanel settlement={settlement} isAdmin={isAdmin} canUpload={isAdmin} />

      <SettlementPaymentPanel settlement={settlement} isAdmin={isAdmin} />

      <SettlementAdjustmentsPanel settlement={settlement} isAdmin={isAdmin} />

      <SettlementReconciliationPanel settlement={settlement} isAdmin={isAdmin} />

      {isAdmin && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Notas administrativas</h2>
          <Textarea
            rows={3}
            value={notes ?? settlement.notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones internas de esta liquidación…"
            disabled={locked}
          />
          <Button
            variant="outline"
            onClick={() => saveNotes.mutate()}
            disabled={saveNotes.isPending || locked || notes === null}
          >
            Guardar notas
          </Button>
          {locked && (
            <p className="text-xs text-muted-foreground">
              Una liquidación aprobada no admite modificaciones.
            </p>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Historial</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                <p className="font-medium">
                  {h.action === "created"
                    ? "Liquidación generada"
                    : h.action === "notes_updated"
                      ? "Notas actualizadas"
                      : h.action === "invoice_submitted"
                        ? "Factura presentada"
                        : h.action === "invoice_approved"
                          ? "Factura aprobada"
                          : h.action === "invoice_rejected"
                            ? "Factura rechazada"
                            : h.action === "payment_recorded"
                              ? "Pago registrado"
                              : `${settlementStatusLabel(h.from_status)} → ${settlementStatusLabel(h.to_status)}`}
                </p>
                {h.comment && <p className="text-muted-foreground">{h.comment}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
