import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_RATE_TYPE,
  listCurrencies,
  listExchangeRateHistory,
  saveExchangeRate,
} from "@/lib/money";

/**
 * Intervención 5 — Economía / Tipo de cambio.
 *
 * Carga y consulta de las cotizaciones del Financial Core
 * (`currency_exchange_rates`, servidas por `currency_rate_at`). El histórico es
 * inmutable: cada alta agrega un registro con su fecha de vigencia, nunca pisa
 * uno anterior. Los importes ya calculados conservan la tasa con la que se
 * sellaron, así que cargar una tasa nueva no modifica cotizaciones ni reservas
 * existentes.
 */
export function CurrencyRatesCard() {
  const qc = useQueryClient();
  const [fromIso, setFromIso] = useState("USD");
  const [toIso, setToIso] = useState("ARS");
  const [rate, setRate] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const currencies = useQuery({ queryKey: ["currencies"], queryFn: () => listCurrencies() });
  const history = useQuery({
    queryKey: ["currency-rate-history"],
    queryFn: () => listExchangeRateHistory(undefined, undefined, 20),
  });

  const options = (currencies.data ?? []).map((c) => c.iso_code);

  async function save() {
    const value = Number(rate);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("El tipo de cambio debe ser mayor a 0");
      return;
    }
    if (fromIso === toIso) {
      toast.error("Las monedas deben ser distintas");
      return;
    }
    setSaving(true);
    try {
      await saveExchangeRate({
        fromIso,
        toIso,
        rate: value,
        rateType: DEFAULT_RATE_TYPE,
        validFrom: new Date(`${validFrom}T00:00:00`),
        note: note.trim() ? note.trim() : null,
      });
      toast.success("Cotización registrada");
      setRate("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["currency-rate-history"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar la cotización");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold">Cotizaciones de monedas</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tasas históricas por par de monedas y fecha de vigencia. Se usan para convertir importes a
        la fecha correspondiente; las cotizaciones y reservas ya emitidas conservan la tasa con la
        que fueron calculadas.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label>De</Label>
          <Select value={fromIso} onValueChange={setFromIso}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>A</Label>
          <Select value={toIso} onValueChange={setToIso}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tasa</Label>
          <Input
            type="number"
            min={0}
            step="0.0001"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="1200"
          />
        </div>
        <div className="space-y-2">
          <Label>Vigente desde</Label>
          <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Referencia</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Dólar operativo"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Registrar cotización
        </Button>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium">Histórico</p>
        {history.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Cargando histórico...</p>
        ) : (history.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Todavía no hay cotizaciones cargadas.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60 text-sm">
            {(history.data ?? []).map((r) => {
              const row = r as typeof r & {
                from_currency?: { iso_code: string } | null;
                to_currency?: { iso_code: string } | null;
              };
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">
                    1 {row.from_currency?.iso_code ?? "?"} ={" "}
                    {Number(r.exchange_rate).toLocaleString("es-AR", {
                      maximumFractionDigits: 4,
                    })}{" "}
                    {row.to_currency?.iso_code ?? "?"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Desde {String(r.valid_from).slice(0, 10)}
                    {r.note ? ` · ${r.note}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
