import { Coins, Lock } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { formatMoney } from "@/lib/currency";
import { paymentKindLabel, paymentStatusLabel, type Booking, type BookingPayment } from "@/lib/bookings";

/**
 * Economía del expediente (v1.9.5.4) — solo lectura.
 *
 * Permisos: el administrador ve venta, costo y margen; Operaciones ve la
 * información operativa sin costos ni márgenes; el agente ve la información
 * comercial de su reserva. Los proveedores no acceden a esta vista.
 */
export function BookingEconomyPanel({
  booking,
  payments,
}: {
  booking: Booking;
  payments: BookingPayment[];
}) {
  const { isAdmin, isOperations } = useAccount();

  const saleCurrency = booking.sale_currency ?? booking.currency;
  const sale = Number(booking.sale_amount ?? booking.amount ?? 0);
  const taxes = Number(booking.taxes_amount ?? 0);
  const extras = Number(booking.extras_amount ?? 0);
  const cost = booking.cost_amount == null ? null : Number(booking.cost_amount);
  const costCurrency = booking.cost_currency ?? saleCurrency;
  const sameCurrency = costCurrency === saleCurrency;
  const margin = cost != null && sameCurrency ? sale - cost : null;
  const marginPct = margin != null && sale > 0 ? (margin / sale) * 100 : null;

  const paid = payments
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <Coins className="h-5 w-5 text-gold" /> Economía del viaje
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consolidado de la reserva. Los costos y márgenes son información sensible del
          administrador.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Venta" value={formatMoney(saleCurrency, sale)} />
          <Metric label="Impuestos" value={formatMoney(saleCurrency, taxes)} />
          <Metric label="Extras" value={formatMoney(saleCurrency, extras)} />
          <Metric label="Cobrado" value={formatMoney(saleCurrency, paid)} />

          {isAdmin ? (
            <>
              <Metric
                label="Costo"
                value={cost == null ? "Sin cargar" : formatMoney(costCurrency, cost)}
              />
              <Metric
                label="Margen ViaE"
                value={
                  margin == null
                    ? sameCurrency
                      ? "—"
                      : "Monedas distintas"
                    : formatMoney(saleCurrency, margin)
                }
              />
              <Metric
                label="Margen %"
                value={marginPct == null ? "—" : `${marginPct.toFixed(1)}%`}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Lock className="h-4 w-4" /> Costos y márgenes restringidos
              </p>
              <p className="mt-1">
                {isOperations
                  ? "Tu perfil accede a la operación completa, sin costos ni márgenes."
                  : "Ves la información comercial de tus reservas y tu comisión."}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold">Cobros registrados</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Concepto</th>
                <th className="py-2 pr-4">Importe</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Método</th>
                <th className="py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                    Sin cobros registrados.
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="py-2 pr-4 font-medium">{paymentKindLabel(p.kind)}</td>
                  <td className="py-2 pr-4">{formatMoney(p.currency, Number(p.amount ?? 0))}</td>
                  <td className="py-2 pr-4">{paymentStatusLabel(p.status)}</td>
                  <td className="py-2 pr-4">{p.method ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">
                    {p.paid_at?.slice(0, 10) ?? p.due_date ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
