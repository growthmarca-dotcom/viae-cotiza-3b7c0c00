import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Ban, History, Loader2, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { formatMoney } from "@/lib/currency";
import {
  COMMISSION_STATUS_CLASSES,
  COMMISSION_STATUS_HELP,
  accrueBookingCommissions,
  accrueServiceCommission,
  baseLabel,
  commissionStatusLabel,
  listBookingCommissionHistory,
  listBookingCommissions,
  setCommissionStatus,
  type Commission,
  type CommissionStatus,
} from "@/lib/commissions";

/**
 * Comisiones devengadas de la reserva (Fase B2).
 *
 * Toda escritura pasa por las RPC existentes: `accrue_booking_commissions`,
 * `accrue_commission` y `set_commission_status`. Nunca se hace INSERT ni
 * UPDATE directo sobre `commissions` desde el frontend, y el historial lo
 * escribe exclusivamente el trigger de la base.
 */
export function CommissionAccrualPanel({
  bookingId,
  bookingStatus,
}: {
  bookingId: string;
  bookingStatus?: string | null;
}) {
  const { isAdmin, isOperations, account } = useAccount();
  const isProvider = (account?.roles.includes("provider") ?? false) && !isOperations;
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState<Commission | null>(null);
  const [comment, setComment] = useState("");

  const eligibleStatuses = ["confirmed", "reserved", "voucher_issued", "in_progress", "completed"];
  const canAccrue = isAdmin && eligibleStatuses.includes(bookingStatus ?? "");

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ["booking-commissions", bookingId],
    queryFn: () => listBookingCommissions(bookingId),
    enabled: !isProvider,
  });

  const ids = commissions.map((c) => c.id);
  const { data: history = [] } = useQuery({
    queryKey: ["booking-commission-history", bookingId, ids],
    queryFn: () => listBookingCommissionHistory(ids),
    enabled: !isProvider && ids.length > 0,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["booking-services-min", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_services")
        .select("id, title")
        .eq("booking_id", bookingId)
        .eq("record_status", "active")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !isProvider,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["booking-commissions", bookingId] });
    qc.invalidateQueries({ queryKey: ["booking-commission-history", bookingId] });
    qc.invalidateQueries({ queryKey: ["commission-simulation", bookingId] });
  };

  const accrueAll = useMutation({
    mutationFn: () => accrueBookingCommissions(bookingId),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(
          res.reason === "booking_not_confirmed"
            ? "La reserva todavía no está confirmada: no corresponde devengar comisiones."
            : "No se pudo devengar: " + (res.reason ?? "error desconocido"),
        );
        return;
      }
      toast.success(
        `Devengo completado · ${res.created ?? 0} nuevas · ${res.already_accrued ?? 0} ya devengadas · ` +
          `${res.without_agreement ?? 0} sin acuerdo · ${res.skipped ?? 0} omitidas`,
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accrueOne = useMutation({
    mutationFn: (serviceId: string) => accrueServiceCommission(serviceId),
    onSuccess: (res) => {
      if (res.ok && res.created) toast.success("Comisión devengada para el servicio.");
      else if (res.reason === "already_accrued") toast.info("El servicio ya tenía comisión devengada.");
      else if (res.reason === "no_agreement")
        toast.warning("Sin acuerdo aplicable: no se generó comisión.");
      else toast.error("No se devengó: " + (res.reason ?? "error desconocido"));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({
      id,
      to,
      note,
    }: {
      id: string;
      to: "approved" | "cancelled";
      note?: string;
    }) => setCommissionStatus(id, to, note),
    onSuccess: (_res, vars) => {
      toast.success(vars.to === "approved" ? "Comisión aprobada" : "Comisión cancelada");
      setCancelling(null);
      setComment("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isProvider) return null;

  const pendingServices = services.filter(
    (s) =>
      !commissions.some(
        (c) => c.booking_service_id === s.id && c.status !== "cancelled" && c.status !== "simulated",
      ),
  );

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-gold" />
            <h2 className="font-display text-xl font-semibold">Comisiones devengadas</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Comisiones registradas a partir de los acuerdos vigentes. El devengo es una acción
            administrativa: no se genera automáticamente al confirmar la reserva.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => accrueAll.mutate()} disabled={!canAccrue || accrueAll.isPending}>
            {accrueAll.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Receipt className="mr-2 h-4 w-4" />
            )}
            Devengar comisiones
          </Button>
        )}
      </header>

      {isAdmin && !canAccrue && (
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          La reserva debe estar confirmada (o en un estado posterior) para devengar comisiones.
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Cargando comisiones…</p>}

      {!isLoading && commissions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay comisiones registradas para esta reserva.
        </p>
      )}

      <ul className="space-y-3">
        {commissions.map((c) => {
          const status = (c.status ?? "accrued") as CommissionStatus;
          const service = services.find((s) => s.id === c.booking_service_id);
          const snapshot = (c.agreement_snapshot ?? {}) as Record<string, unknown>;
          const ruleSnapshot = (c.rule_snapshot ?? {}) as Record<string, unknown>;
          return (
            <li key={c.id} className="rounded-xl border border-border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{service?.title ?? "Servicio de la reserva"}</p>
                  <p className="text-xs text-muted-foreground">
                    {COMMISSION_STATUS_HELP[status]}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${COMMISSION_STATUS_CLASSES[status]}`}
                  >
                    {commissionStatusLabel(status)}
                  </span>
                  <p className="font-display text-base font-semibold">
                    {c.commission_amount != null
                      ? formatMoney(c.currency ?? "ARS", Number(c.commission_amount))
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>
                  Acuerdo: {(snapshot["title"] as string) ?? "—"}
                  {c.agreement_version ? ` · v${c.agreement_version}` : ""}
                </p>
                <p>Regla: {(ruleSnapshot["label"] as string) ?? "Condición general del acuerdo"}</p>
                <p>
                  Base: {baseLabel(c.base)} ·{" "}
                  {c.calc_type === "percentage"
                    ? `${Number(c.calc_value)}%`
                    : formatMoney(c.currency ?? "ARS", Number(c.calc_value))}
                </p>
                <p>
                  Devengada el{" "}
                  {new Date(c.computed_at).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                {isAdmin && c.base_amount != null && (
                  <p>Base calculada: {formatMoney(c.currency ?? "ARS", Number(c.base_amount))}</p>
                )}
                {c.exchange_rate != null && (
                  <p>
                    TC sellado: {Number(c.exchange_rate).toLocaleString("es-AR")}
                    {c.exchange_rate_date ? ` · ${c.exchange_rate_date}` : ""}
                    {c.exchange_rate_source ? ` · ${c.exchange_rate_source}` : ""}
                  </p>
                )}
              </div>

              {isAdmin && (status === "accrued" || status === "approved") && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {status === "accrued" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={changeStatus.isPending}
                      onClick={() => changeStatus.mutate({ id: c.id, to: "approved" })}
                    >
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      Aprobar comisión
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      setCancelling(c);
                      setComment("");
                    }}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Cancelar comisión
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isAdmin && pendingServices.length > 0 && commissions.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-4">
          <p className="text-sm font-medium">Servicios sin comisión registrada</p>
          <ul className="mt-2 space-y-2">
            {pendingServices.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{s.title ?? "Servicio"}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canAccrue || accrueOne.isPending}
                  onClick={() => accrueOne.mutate(s.id)}
                >
                  Devengar este servicio
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Si un servicio no tiene acuerdo aplicable, no se genera comisión.{" "}
            <Link to="/agreements" className="underline">
              Configurar acuerdos
            </Link>
          </p>
        </div>
      )}

      {/* Historial: proviene exclusivamente de commission_history (append-only). */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Historial</h3>
        </div>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin movimientos registrados.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-2 border-b border-border pb-2 last:border-0">
                <span>
                  {new Date(h.created_at).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="font-medium text-foreground">
                  {h.from_status ? commissionStatusLabel(h.from_status) : "Nueva"} →{" "}
                  {commissionStatusLabel(h.to_status)}
                </span>
                {h.comment && <span>· {h.comment}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={Boolean(cancelling)} onOpenChange={(v) => !v && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar la comisión?</AlertDialogTitle>
            <AlertDialogDescription>
              La comisión dejará de ser válida, pero el registro histórico permanece. No se elimina
              ningún dato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Motivo de la cancelación (opcional)"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                cancelling &&
                changeStatus.mutate({ id: cancelling.id, to: "cancelled", note: comment })
              }
            >
              Cancelar comisión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
