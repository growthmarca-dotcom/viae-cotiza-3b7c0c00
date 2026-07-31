import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TicketCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CURRENCIES, needsExchangeRate } from "@/lib/currency";
import { agentFullName, listAssignableAgents } from "@/lib/agents";
import {
  BOOKING_STATUSES,
  createBooking,
  type BookingOrigin,
  type BookingStatus,
} from "@/lib/bookings";

export type BookingDefaults = {
  clientId: string;
  agentId?: string | null;
  destination?: string | null;
  travelStart?: string | null;
  travelEnd?: string | null;
  amount?: number | null;
  currency?: string | null;
  exchangeRate?: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: BookingOrigin;
  defaults: BookingDefaults;
  onCreated?: (bookingId: string) => void;
};

/**
 * Alta de reserva. Sólo se monta desde una oportunidad o una cotización:
 * el origen es obligatorio y no se puede editar desde aquí.
 */
export function BookingCreateDialog({ open, onOpenChange, origin, defaults, onCreated }: Props) {
  const { data: agents } = useQuery({
    queryKey: ["assignable-agents"],
    queryFn: listAssignableAgents,
    enabled: open,
  });

  const [status, setStatus] = useState<BookingStatus>("pending");
  const [destination, setDestination] = useState("");
  const [travelStart, setTravelStart] = useState("");
  const [travelEnd, setTravelEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [rate, setRate] = useState("");
  const [agentId, setAgentId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus("pending");
    setDestination(defaults.destination ?? "");
    setTravelStart(defaults.travelStart ?? "");
    setTravelEnd(defaults.travelEnd ?? "");
    setAmount(defaults.amount != null ? String(defaults.amount) : "");
    setCurrency(defaults.currency ?? "USD");
    setRate(defaults.exchangeRate != null ? String(defaults.exchangeRate) : "");
    setAgentId(defaults.agentId ?? "");
    setNotes("");
  }, [open, defaults]);

  async function handleSubmit() {
    if (!defaults.clientId) {
      toast.error("La oportunidad o cotización debe tener un cliente asociado.");
      return;
    }
    setSaving(true);
    try {
      const id = await createBooking(origin, {
        client_id: defaults.clientId,
        assigned_agent_id: agentId || null,
        status,
        travel_start: travelStart || null,
        travel_end: travelEnd || null,
        destination: destination.trim() || null,
        amount: Number(amount) || 0,
        currency,
        exchange_rate: rate.trim() === "" ? null : Number(rate),
        notes: notes.trim() || null,
      });
      toast.success("Reserva creada");
      onOpenChange(false);
      onCreated?.(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la reserva");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <TicketCheck className="h-5 w-5 text-gold" /> Nueva reserva
          </DialogTitle>
          <DialogDescription>
            La reserva se genera a partir de{" "}
            {origin.quotationId ? "la cotización" : "la oportunidad"} y hereda su cliente,
            importe y fechas. Podés ajustarlos antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Estado inicial</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BookingStatus)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {BOOKING_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Agente responsable</Label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sin asignar</option>
              {(agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {agentFullName(a)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Destino</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fecha de viaje</Label>
            <Input type="date" value={travelStart} onChange={(e) => setTravelStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fecha de regreso</Label>
            <Input type="date" value={travelEnd} onChange={(e) => setTravelEnd(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Importe</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Tipo de cambio utilizado</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={needsExchangeRate(currency) ? "Ej: 1000 (ARS por USD)" : "Opcional"}
            />
            <p className="text-xs text-muted-foreground">
              Se guarda el tipo de cambio del momento de la reserva para que las estadísticas no
              mezclen monedas.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Observaciones</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
