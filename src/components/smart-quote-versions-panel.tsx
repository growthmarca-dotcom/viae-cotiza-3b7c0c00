import { useCallback, useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/currency";
import {
  listSmartQuoteVersions,
  type SmartQuoteVersionRow,
} from "@/lib/smartQuotes";

/**
 * v1.12.4 (Fase 2.3) — Historial de versiones (solo lectura).
 * No hay restauración de versiones en esta fase.
 */
export function SmartQuoteVersionsPanel({
  smartQuoteId,
  refreshKey,
  fallbackCurrency,
}: {
  smartQuoteId: string;
  /** Cambia cuando la cotización se modifica, para recargar el historial. */
  refreshKey?: string | number;
  fallbackCurrency: string;
}) {
  const [versions, setVersions] = useState<SmartQuoteVersionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVersions(await listSmartQuoteVersions(smartQuoteId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [smartQuoteId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <History className="h-4 w-4 text-gold" /> Historial de versiones
        </h2>
        <span className="text-xs text-muted-foreground">
          {versions.length} {versions.length === 1 ? "versión" : "versiones"}
        </span>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...
        </p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay versiones registradas para esta cotización.
        </p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="grid gap-1 rounded-xl border border-border bg-background p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
            >
              <span className="inline-flex w-fit items-center rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs font-medium">
                v{v.version}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{v.reason ?? "Cambio registrado"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleString()} ·{" "}
                  {v.created_by_name ?? (v.created_by ? "Usuario del sistema" : "Sin autor")}
                </p>
              </div>
              <p className="text-sm font-semibold sm:text-right">
                {formatMoney(v.currency || fallbackCurrency, Number(v.total_amount ?? 0))}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        El historial es de solo lectura: cada versión conserva el estado completo de la cotización.
        La restauración de versiones se habilitará en una etapa posterior.
      </p>
    </section>
  );
}
