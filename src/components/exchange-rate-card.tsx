import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  EMPTY_EXCHANGE_RATE,
  formatRate,
  listExchangeRates,
  saveExchangeRate,
  type ExchangeRateInput,
} from "@/lib/exchange-rates";

/**
 * Tipo de cambio operativo (v1.6): carga manual del dólar del día con fecha de
 * vigencia. Se guarda histórico y se registra el usuario que lo cargó.
 */
export function ExchangeRateCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ExchangeRateInput>(EMPTY_EXCHANGE_RATE);
  const [saving, setSaving] = useState(false);

  const { data: rates, isLoading } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: () => listExchangeRates(12),
  });

  const current = rates?.[0] ?? null;

  async function save() {
    setSaving(true);
    try {
      await saveExchangeRate(form);
      toast.success("Tipo de cambio actualizado");
      setForm({ ...EMPTY_EXCHANGE_RATE });
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el tipo de cambio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold">Tipo de cambio operativo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Carga manual del dólar del día con fecha de vigencia. Se guarda el histórico y el usuario
        que lo actualizó. Los servicios ya confirmados conservan el tipo de cambio con el que
        fueron cargados. La conexión con una API externa queda preparada para más adelante.
      </p>

      <div className="mt-4 rounded-xl border border-border/70 bg-secondary/30 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Vigente</p>
        <p className="mt-1 font-display text-2xl font-semibold">{formatRate(current)}</p>
        {current && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Desde {current.effective_date} · carga{" "}
            {current.source === "manual" ? "manual" : current.source}
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Dólar del día (ARS por 1 USD)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.rate}
            onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
            placeholder="1200"
          />
        </div>
        <div className="space-y-2">
          <Label>Fecha de vigencia</Label>
          <Input
            type="date"
            value={form.effective_date}
            onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Referencia</Label>
          <Input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Dólar mayorista"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Registrar tipo de cambio
        </Button>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium">Histórico</p>
        {isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Cargando histórico...</p>
        ) : (rates ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no cargaste tipos de cambio.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60 text-sm">
            {(rates ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{formatRate(r)}</span>
                <span className="text-xs text-muted-foreground">
                  Vigencia {r.effective_date}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
