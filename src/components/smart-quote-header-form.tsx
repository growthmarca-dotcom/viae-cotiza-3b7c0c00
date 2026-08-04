import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currency";
import {
  parseSmartQuotePassengers,
  updateSmartQuoteHeader,
  type SmartQuoteListRow,
} from "@/lib/smartQuotes";

/**
 * v1.12.3 (Fase 2.2) — Edición de la cabecera comercial de una Smart Quote.
 * Sólo campos comerciales: cliente, agente, oportunidad y organización se
 * heredan del flujo y están protegidos por la base.
 */
export function SmartQuoteHeaderForm({
  quote,
  editable,
  onSaved,
}: {
  quote: SmartQuoteListRow;
  editable: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const initialPassengers = parseSmartQuotePassengers(quote.passengers_metadata);
  const [title, setTitle] = useState(quote.title);
  const [country, setCountry] = useState(quote.destination_country ?? "");
  const [state, setState] = useState(quote.destination_state ?? "");
  const [city, setCity] = useState(quote.destination_city ?? "");
  const [startDate, setStartDate] = useState(quote.start_date ?? "");
  const [endDate, setEndDate] = useState(quote.end_date ?? "");
  const [adults, setAdults] = useState(String(initialPassengers.adults));
  const [children, setChildren] = useState(String(initialPassengers.children));
  const [infants, setInfants] = useState(String(initialPassengers.infants));
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [currency, setCurrency] = useState(quote.currency);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = parseSmartQuotePassengers(quote.passengers_metadata);
    setTitle(quote.title);
    setCountry(quote.destination_country ?? "");
    setState(quote.destination_state ?? "");
    setCity(quote.destination_city ?? "");
    setStartDate(quote.start_date ?? "");
    setEndDate(quote.end_date ?? "");
    setAdults(String(p.adults));
    setChildren(String(p.children));
    setInfants(String(p.infants));
    setNotes(quote.notes ?? "");
    setCurrency(quote.currency);
  }, [quote]);

  const currencyChanged = currency.toUpperCase() !== quote.currency.toUpperCase();

  async function save() {
    setSaving(true);
    try {
      await updateSmartQuoteHeader(quote.id, {
        title,
        destination_country: country,
        destination_state: state,
        destination_city: city,
        start_date: startDate,
        end_date: endDate,
        passengers: {
          adults: Number(adults),
          children: Number(children),
          infants: Number(infants),
        },
        notes,
        currency,
      });
      toast.success("Cotización actualizada");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la cotización");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Datos de la cotización</h2>
        {!editable && (
          <span className="text-xs text-muted-foreground">Solo lectura</span>
        )}
      </div>

      <fieldset disabled={!editable || saving} className="space-y-4">
        <div>
          <Label htmlFor="sq-h-title">Título</Label>
          <Input
            id="sq-h-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="sq-h-city">Ciudad</Label>
            <Input
              id="sq-h-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="San Carlos de Bariloche"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="sq-h-state">Provincia / Estado</Label>
            <Input
              id="sq-h-state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="Río Negro"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="sq-h-country">País</Label>
            <Input
              id="sq-h-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Argentina"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="sq-h-start">Desde</Label>
            <Input
              id="sq-h-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="sq-h-end">Hasta</Label>
            <Input
              id="sq-h-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="sq-h-adults">Adultos</Label>
            <Input
              id="sq-h-adults"
              type="number"
              min="1"
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="sq-h-children">Menores</Label>
            <Input
              id="sq-h-children"
              type="number"
              min="0"
              value={children}
              onChange={(e) => setChildren(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="sq-h-infants">Infantes</Label>
            <Input
              id="sq-h-infants"
              type="number"
              min="0"
              value={infants}
              onChange={(e) => setInfants(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {currencyChanged && (
          <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs text-foreground">
            Al guardar, la moneda de todos los ítems pasa a {currency.toUpperCase()}. Los importes
            se mantienen tal cual: se redenominan, no se convierten.
          </p>
        )}

        <div>
          <Label htmlFor="sq-h-notes">Notas internas</Label>
          <Textarea
            id="sq-h-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Condiciones, preferencias del pasajero, pendientes..."
            className="mt-1.5"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Uso interno del equipo: no se muestran al cliente.
          </p>
        </div>
      </fieldset>

      {editable && (
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar cambios
        </Button>
      )}
    </section>
  );
}
