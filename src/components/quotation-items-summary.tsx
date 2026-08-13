import {
  CATEGORY_LABELS,
  QUOTATION_ITEM_CATEGORIES,
  itemSubtotal,
  itemsTotal,
  type QuotationItemCategory,
  type QuotationItemDraft,
} from "@/lib/quotationItems";
import { formatMoney } from "@/lib/currency";

export type SummaryExtraLine = { label: string; amount: number };

/**
 * Resumen general de la cotización integral: agrupa los servicios por categoría
 * y suma el bloque de alojamiento histórico (líneas extra) para el total final.
 */
export function QuotationItemsSummary({
  currency,
  items,
  extraLines = [],
  title = "Resumen general",
}: {
  currency: string;
  items: QuotationItemDraft[];
  extraLines?: SummaryExtraLine[];
  title?: string;
}) {
  const extraTotal = extraLines.reduce((a, l) => a + l.amount, 0);
  const total = Math.round((itemsTotal(items) + extraTotal) * 100) / 100;
  const byCategory = QUOTATION_ITEM_CATEGORIES.map((c) => ({
    category: c.value as QuotationItemCategory,
    label: c.label,
    list: items.filter((i) => i.category === c.value),
  })).filter((g) => g.list.length > 0);

  if (byCategory.length === 0 && extraLines.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 font-display text-xl font-semibold">{title}</h2>
      <div className="space-y-4 text-sm">
        {extraLines.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS.accommodation}
            </p>
            <ul className="mt-1.5 space-y-1">
              {extraLines.map((l) => (
                <li key={l.label} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{l.label}</span>
                  <span className="font-medium">{formatMoney(currency, l.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {byCategory.map((g) => (
          <div key={g.category}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </p>
            <ul className="mt-1.5 space-y-1">
              {g.list.map((i) => (
                <li key={i.key} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {i.title || `${g.label} sin nombre`}
                    {i.requirement && itemSubtotal(i) === 0 ? (
                      <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        requerimiento
                      </span>
                    ) : null}
                  </span>
                  <span className="font-medium">{formatMoney(currency, itemSubtotal(i))}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="font-display text-base font-semibold">TOTAL COTIZACIÓN</span>
          <span className="font-display text-xl font-semibold text-primary">
            {formatMoney(currency, total)}
          </span>
        </div>
      </div>
    </div>
  );
}
