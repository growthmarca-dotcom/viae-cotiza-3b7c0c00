import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { useAccount } from "@/hooks/use-account";
import { SettlementInvoicePanel } from "@/components/settlement-invoice-panel";
import { SettlementPaymentPanel } from "@/components/settlement-payment-panel";
import {
  SETTLEMENT_STATUS_CLASSES,
  SETTLEMENT_STATUS_HELP,
  listMySettlements,
  periodLabel,
  settlementStatusLabel,
  type SettlementStatus,
} from "@/lib/settlements";

export const Route = createFileRoute("/_authenticated/my-settlements")({
  component: MySettlementsPage,
  head: () => ({
    meta: [
      { title: "Mis liquidaciones — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Liquidaciones de comisiones del beneficiario: período, importe, moneda, estado de la factura y fecha de pago.",
      },
      { property: "og:title", content: "Mis liquidaciones — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Consultá tus liquidaciones y presentá la factura correspondiente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/**
 * Acceso del beneficiario (agente o agencia). El recorte lo hace RLS: sólo se
 * ven las liquidaciones propias. Desde acá se presenta la factura; la revisión
 * y el pago son siempre administrativos.
 */
function MySettlementsPage() {
  const { isAdmin } = useAccount();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-settlements"],
    queryFn: listMySettlements,
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Comisiones a liquidar</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Mis liquidaciones
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cuando una liquidación está aprobada podés subir tu factura. Administración la revisa y
          después registra el pago.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Wallet className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no tenés liquidaciones generadas.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {rows.map((s) => {
            const st = s.status as SettlementStatus;
            return (
              <article
                key={s.id}
                className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {periodLabel(s.period_start, s.period_end)}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold tracking-tight">
                      {formatMoney(s.currency, Number(s.total_commission_amount ?? 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.commission_count} comisión(es) en {s.currency}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${SETTLEMENT_STATUS_CLASSES[st]}`}
                    >
                      {settlementStatusLabel(st)}
                    </span>
                    <p className="mt-2 max-w-xs text-xs text-muted-foreground">
                      {SETTLEMENT_STATUS_HELP[st]}
                    </p>
                  </div>
                </div>

                <SettlementInvoicePanel settlement={s} isAdmin={isAdmin} canUpload />
                <SettlementPaymentPanel settlement={s} isAdmin={isAdmin} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
