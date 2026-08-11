import { useEffect, useState } from "react";
import { BadgeDollarSign, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-account";
import { useAnalysisCurrency } from "@/hooks/use-analysis-currency";
import { formatMoney } from "@/lib/currency";
import { latestExchangeRate } from "@/lib/exchange-rates";
import {
  convertAmount,
  economicsToInput,
  ECONOMIC_CURRENCIES,
  formatConverted,
  marginOf,
  saveServiceEconomics,
  SETTLEMENT_STATUSES,
  settlementClasses,
  settlementLabel,
  type EconomicCurrency,
  type ServiceEconomicsInput,
  type SettlementStatus,
} from "@/lib/transport-economics";
import type { TransportService } from "@/lib/transport";
import { fareFromNetCostInput } from "@/lib/fare-pricing";


/**
 * Economía del servicio de transporte (v1.6).
 *
 * Precio de venta al pasajero, costo del proveedor/conductor y margen ViaE.
 * El costo y el margen SÓLO se muestran al administrador; el agente ve
 * únicamente la información comercial (precio de venta y cobro).
 */
export function ServiceEconomicsPanel({
  service,
  onSaved,
}: {
  service: TransportService;
  onSaved?: () => void;
}) {
  const { isAdmin } = useAccount();
  const analysisCurrency = useAnalysisCurrency();
  const [form, setForm] = useState<ServiceEconomicsInput>(economicsToInput(service));
  const [saving, setSaving] = useState(false);
  const [suggestedRate, setSuggestedRate] = useState<number | null>(null);

  useEffect(() => {
    setForm(economicsToInput(service));
  }, [service]);

  useEffect(() => {
    let active = true;
    latestExchangeRate()
      .then((r) => {
        if (active) setSuggestedRate(r ? Number(r.rate) : null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function set<K extends keyof ServiceEconomicsInput>(key: K, value: ServiceEconomicsInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const saleConverted = convertAmount(
    form.sale_amount.trim() === "" ? null : Number(form.sale_amount),
    form.sale_currency,
    form.sale_exchange_rate.trim() === "" ? null : Number(form.sale_exchange_rate),
  );
  const costConverted = convertAmount(
    form.cost_amount.trim() === "" ? null : Number(form.cost_amount),
    form.cost_currency,
    form.cost_exchange_rate.trim() === "" ? null : Number(form.cost_exchange_rate),
  );

  const margin = marginOf(service, analysisCurrency);

  /**
   * Precio sugerido al pasajero según el motor de cálculo de cobro
   * (src/lib/fare-pricing.ts): costo neto del recurso + comisión NQN,
   * con el costo estimado de Mercado Pago trasladado por tasa inversa.
   * Sólo es una sugerencia visual: no persiste ni altera el flujo de cobro.
   */
  const fare = fareFromNetCostInput(form.cost_amount);


  async function save() {
    setSaving(true);
    try {
      await saveServiceEconomics(service.id, form);
      toast.success("Economía del servicio actualizada");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function applySuggested(target: "sale" | "cost") {
    if (suggestedRate == null) {
      toast.error("Cargá el tipo de cambio operativo en Configuración.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    setForm((f) =>
      target === "sale"
        ? { ...f, sale_exchange_rate: String(suggestedRate), sale_rate_date: today }
        : { ...f, cost_exchange_rate: String(suggestedRate), cost_rate_date: today },
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-border/70 bg-secondary/20 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <BadgeDollarSign className="h-4 w-4 text-gold" /> Economía del servicio
      </p>

      {/* --- Venta al pasajero (admin y agente) */}
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Precio de venta</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.sale_amount}
            onChange={(e) => set("sale_amount", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Moneda</Label>
          <CurrencySelect
            value={form.sale_currency}
            onChange={(v) => set("sale_currency", v)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo de cambio aplicado</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.sale_exchange_rate}
            onChange={(e) => set("sale_exchange_rate", e.target.value)}
            placeholder={suggestedRate != null ? String(suggestedRate) : "ARS por 1 USD"}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha del tipo de cambio</Label>
          <Input
            type="date"
            value={form.sale_rate_date}
            onChange={(e) => set("sale_rate_date", e.target.value)}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Equivalencia: {formatConverted(saleConverted)}</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => applySuggested("sale")}>
          Usar dólar del día
        </Button>
      </div>

      {/* --- Costo y margen (sólo administrador) */}
      {isAdmin && (
        <>
          <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Costo del recurso</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.cost_amount}
                onChange={(e) => set("cost_amount", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moneda</Label>
              <CurrencySelect
                value={form.cost_currency}
                onChange={(v) => set("cost_currency", v)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de cambio</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.cost_exchange_rate}
                onChange={(e) => set("cost_exchange_rate", e.target.value)}
                placeholder={suggestedRate != null ? String(suggestedRate) : "ARS por 1 USD"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha del tipo de cambio</Label>
              <Input
                type="date"
                value={form.cost_rate_date}
                onChange={(e) => set("cost_rate_date", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Equivalencia: {formatConverted(costConverted)}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => applySuggested("cost")}>
              Usar dólar del día
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric
              label={`Venta (${analysisCurrency})`}
              value={margin.sale != null ? formatMoney(analysisCurrency, margin.sale) : "—"}
            />
            <Metric
              label={`Costo (${analysisCurrency})`}
              value={margin.cost != null ? formatMoney(analysisCurrency, margin.cost) : "—"}
            />
            <Metric
              label="Margen bruto ViaE"
              value={
                margin.gross != null
                  ? `${formatMoney(analysisCurrency, margin.gross)}${
                      margin.percent != null ? ` · ${margin.percent}%` : ""
                    }`
                  : "—"
              }
            />
          </div>
          {margin.incomplete && (
            <p className="mt-2 text-xs text-destructive">
              Falta tipo de cambio: algún importe no pudo convertirse a {analysisCurrency}.
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Liquidación al proveedor</Label>
              <Select
                value={form.settlement_status}
                onValueChange={(v) => set("settlement_status", v as SettlementStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETTLEMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nota de liquidación</Label>
              <Textarea
                rows={2}
                value={form.settlement_note}
                onChange={(e) => set("settlement_note", e.target.value)}
                placeholder="Sin pagos reales: sólo seguimiento del estado."
              />
            </div>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs ${settlementClasses(service.settlement_status)}`}
        >
          {settlementLabel(service.settlement_status)}
        </span>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar economía
        </Button>
      </div>
    </div>
  );
}

function CurrencySelect({
  value,
  onChange,
}: {
  value: EconomicCurrency;
  onChange: (v: EconomicCurrency) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as EconomicCurrency)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ECONOMIC_CURRENCIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
