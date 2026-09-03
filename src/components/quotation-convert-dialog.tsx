import { useState } from "react";
import { Loader2, TicketCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { createBooking } from "@/lib/bookings";

export type QuotationConvertSummary = {
  quotationId: string;
  quotationNumber: string | null;
  clientId: string;
  clientName: string;
  destination: string | null;
  travelStart: string | null;
  travelEnd: string | null;
  paxCount: number | null;
  servicesCount: number;
  amount: number;
  currency: string;
  exchangeRate: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: QuotationConvertSummary;
  onConverted: (bookingId: string) => void;
};

/**
 * Intervención 7 — Conversión asistida de cotización aceptada -> reserva.
 * Solo confirma: la creación reutiliza `createBooking()` (idempotente por
 * `bookings.quotation_id`) y su traslado de servicios y pasajeros.
 */
export function QuotationConvertDialog({ open, onOpenChange, summary, onConverted }: Props) {
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      const bookingId = await createBooking(
        { quotationId: summary.quotationId },
        {
          client_id: summary.clientId,
          assigned_agent_id: null,
          status: "pending",
          travel_start: summary.travelStart,
          travel_end: summary.travelEnd,
          destination: summary.destination,
          amount: summary.amount,
          currency: summary.currency,
          exchange_rate: summary.exchangeRate,
          notes: summary.quotationNumber
            ? `Reserva generada por conversión de la cotización ${summary.quotationNumber}.`
            : "Reserva generada por conversión de una cotización aceptada.",
        },
      );
      onOpenChange(false);
      onConverted(bookingId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la reserva");
    } finally {
      setSaving(false);
    }
  }

  const dates =
    summary.travelStart || summary.travelEnd
      ? `${summary.travelStart ?? "—"} → ${summary.travelEnd ?? "—"}`
      : "Sin fechas definidas";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-display">
            <TicketCheck className="h-5 w-5 text-gold" /> Convertir a reserva
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se creará una reserva a partir de esta cotización. Podrás completar o modificar la
            información operativa posteriormente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="grid gap-2 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
          <Line label="Cliente" value={summary.clientName} />
          <Line
            label="Cotización"
            value={summary.quotationNumber ?? "Sin número"}
          />
          <Line label="Destino" value={summary.destination ?? "—"} />
          <Line label="Fechas" value={dates} />
          <Line
            label="Pasajeros"
            value={summary.paxCount != null ? String(summary.paxCount) : "—"}
          />
          <Line label="Servicios" value={`${summary.servicesCount}`} />
          <Line
            label="Importe"
            value={formatMoney(summary.currency, summary.amount)}
          />
          <Line label="Moneda" value={summary.currency} />
        </dl>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <Button onClick={confirm} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar conversión
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
