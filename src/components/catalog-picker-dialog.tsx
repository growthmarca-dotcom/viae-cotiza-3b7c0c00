import { useEffect, useMemo, useState } from "react";
import { getAvailabilityStatuses, getUnitsAvailability } from "@/lib/accommodationAvailability";
import { useQuery } from "@tanstack/react-query";
import { Library, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/currency";
import {
  CATALOG_CATEGORY_LABELS,
  listCatalogProducts,
  productDestinationNames,
  type CatalogProduct,
} from "@/lib/catalog";

/** Sin mayúsculas, acentos ni espacios repetidos. */
const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const STATUS_LABELS: Record<string, string> = { active: "Activo", draft: "Borrador", inactive: "Inactivo", archived: "Archivado" };

/**
 * Selector de productos activos del catálogo. Al elegir, el llamador copia los
 * datos (snapshot) en la cotización: no queda referencia viva al catálogo.
 */
export function CatalogPickerButton({
  categories,
  onPick,
  label = "Desde catálogo",
  context,
}: {
  categories: string[];
  /** `unit` = unidad/habitación concreta elegida (solo alojamientos con unidades). */
  onPick: (p: CatalogProduct, unit?: { id: string; name: string }) => void;
  label?: string;
  /** Destino y fechas de la cotización (check-out exclusivo) para mostrar disponibilidad de alojamientos. */
  context?: { destination?: string; from?: string; to?: string };
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [dest, setDest] = useState("");
  const [prov, setProv] = useState("");
  const [status, setStatus] = useState("active");
  const clear = () => { setQ(""); setCat(""); setDest(""); setProv(""); setStatus("active"); };
  const { data = [], isLoading } = useQuery({
    queryKey: ["catalog-products"],
    queryFn: listCatalogProducts,
    enabled: open,
  });
  const base = useMemo(() => data.filter((p) => categories.includes(p.category)), [data, categories]);
  const destOptions = useMemo(
    () => [...new Set(base.flatMap((p) => productDestinationNames(p)))].sort((a, b) => a.localeCompare(b)),
    [base],
  );
  const provOptions = useMemo(
    () => [...new Set(base.map((p) => p.provider?.trade_name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [base],
  );
  const statusOptions = useMemo(() => [...new Set(base.map((p) => p.status))], [base]);
  const withDates = !!(context?.from && context?.to && context.to > context.from);
  const [hideUnavailable, setHideUnavailable] = useState(true);
  const [destApplied, setDestApplied] = useState(false);
  useEffect(() => {
    if (!open) { setDestApplied(false); return; }
    if (destApplied || !context?.destination || destOptions.length === 0) return;
    const match = destOptions.find((d) => norm(d) === norm(context.destination!));
    if (match) setDest(match);
    setDestApplied(true);
  }, [open, destApplied, context?.destination, destOptions]);
  const { data: avail = {} } = useQuery({
    queryKey: ["catalog-availability", context?.from, context?.to, base.map((p) => p.id).join(",")],
    queryFn: () => getAvailabilityStatuses(base.map((p) => p.id), context!.from!, context!.to!),
    enabled: open && withDates && base.length > 0,
  });
  const { data: unitRows = [] } = useQuery({
    queryKey: ["catalog-units-availability", context?.from, context?.to, base.map((p) => p.id).join(",")],
    queryFn: () => getUnitsAvailability(base.map((p) => p.id), withDates ? context!.from : undefined, withDates ? context!.to : undefined),
    enabled: open && !!context && categories.includes("accommodation") && base.length > 0,
  });
  const unitsByProduct = useMemo(() => {
    const m = new Map<string, typeof unitRows>();
    for (const u of unitRows) m.set(u.product_id, [...(m.get(u.product_id) ?? []), u]);
    return m;
  }, [unitRows]);
  const filtered = useMemo(() => {
    const s = norm(q);
    return base.filter(
      (p) =>
        (!status || p.status === status) &&
        (!cat || p.category === cat) &&
        (!dest || productDestinationNames(p).includes(dest)) &&
        (!prov || p.provider?.trade_name === prov) &&
        (!s ||
          [p.name, p.internal_code, p.provider?.trade_name, ...productDestinationNames(p)]
            .filter(Boolean)
            .some((v) => norm(String(v)).includes(s))),
    );
  }, [base, q, cat, dest, prov, status]);
  const rank = { available: 0, unknown: 1, unavailable: 2 } as const;
  const stateOf = (id: string) => avail[id] ?? "unknown";
  const counts = useMemo(() => {
    const c = { available: 0, unknown: 0, unavailable: 0 };
    for (const p of filtered) c[stateOf(p.id)]++;
    return c;
  }, [filtered, avail]);
  const list = useMemo(() => {
    if (!withDates) return filtered;
    return [...filtered]
      .filter((p) => !hideUnavailable || stateOf(p.id) !== "unavailable")
      .sort((a, b) => rank[stateOf(a.id)] - rank[stateOf(b.id)]);
  }, [filtered, avail, withDates, hideUnavailable]);
  const fmtD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-AR");
  const selCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Library className="mr-2 h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Elegir del catálogo</DialogTitle>
            <DialogDescription>
              Los datos se copian en la cotización. Cambios futuros del catálogo no la modifican.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar producto, destino o proveedor" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 1 && (
              <select aria-label="Categoría" className={selCls} value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categories.map((c) => <option key={c} value={c}>{CATALOG_CATEGORY_LABELS[c] ?? c}</option>)}
              </select>
            )}
            <select aria-label="Destino" className={selCls} value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">Todos los destinos</option>
              {destOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select aria-label="Proveedor" className={selCls} value={prov} onChange={(e) => setProv(e.target.value)}>
              <option value="">Todos los proveedores</option>
              {provOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select aria-label="Estado" className={selCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              {statusOptions.map((d) => <option key={d} value={d}>{STATUS_LABELS[d] ?? d}</option>)}
            </select>
            <Button type="button" variant="ghost" size="sm" onClick={clear}>Limpiar filtros</Button>
          </div>
          {withDates && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs">
              <span>
                Resultados para {dest || context?.destination || "todos los destinos"} · {fmtD(context!.from!)} → {fmtD(context!.to!)}
                <br />
                🟢 {counts.available} con disponibilidad verificada · ⚪ {counts.unknown} consultar disponibilidad · 🔴 {counts.unavailable} no disponibles
              </span>
              {counts.unavailable > 0 && (
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={!hideUnavailable} onChange={(e) => setHideUnavailable(!e.target.checked)} />
                  Mostrar no disponibles
                </label>
              )}
            </div>
          )}
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>}
            {!isLoading && list.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay productos que coincidan con la búsqueda y los filtros.
              </p>
            )}
            {list.map((p) => {
              const units = unitsByProduct.get(p.id) ?? [];
              return (
              <div key={p.id} className="rounded-xl border border-border bg-background">
              <button
                                type="button"
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors hover:border-primary"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATALOG_CATEGORY_LABELS[p.category]}
                    {productDestinationNames(p).length ? ` · ${productDestinationNames(p).join(", ")}` : ""}
                    {p.provider ? ` · ${p.provider.trade_name}` : ""}
                  </p>
                  {withDates && (
                    <p className="mt-0.5 text-xs">
                      {stateOf(p.id) === "available"
                        ? "🟢 Disponible · Disponibilidad verificada"
                        : stateOf(p.id) === "unavailable"
                          ? "🔴 No disponible"
                          : "⚪ Consultar disponibilidad · No sincronizada"}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium">
                  {p.sale_amount != null ? formatMoney(p.currency, Number(p.sale_amount)) : "Sin precio"}
                </span>
              </button>
                {units.length > 0 && (
                  <div className="space-y-1 border-t px-3 pb-3 pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Unidades{withDates ? " para esas fechas" : ""} · elegí una:</p>
                    <div className="flex flex-wrap gap-2">
                      {units.map((u) => (
                        <button
                          key={u.variant_id}
                          type="button"
                          disabled={u.status === "unavailable"}
                          onClick={() => { onPick(p, { id: u.variant_id, name: u.name }); setOpen(false); }}
                          className="rounded-full border px-3 py-1 text-xs hover:border-primary disabled:opacity-50"
                        >
                          {u.status === "available" ? "🟢" : u.status === "unavailable" ? "🔴" : "⚪"} {u.name}
                          {u.status === "unavailable" ? " — No disponible" : u.status === "available" ? " — Disponible" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
