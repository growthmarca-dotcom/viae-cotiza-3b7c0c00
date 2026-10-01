import { useMemo, useState } from "react";
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

const STATUS_LABELS: Record<string, string> = { active: "Activo", draft: "Borrador", inactive: "Inactivo", archived: "Archivado" };

/**
 * Selector de productos activos del catálogo. Al elegir, el llamador copia los
 * datos (snapshot) en la cotización: no queda referencia viva al catálogo.
 */
export function CatalogPickerButton({
  categories,
  onPick,
  label = "Desde catálogo",
}: {
  categories: string[];
  onPick: (p: CatalogProduct) => void;
  label?: string;
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
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return base.filter(
      (p) =>
        (!status || p.status === status) &&
        (!cat || p.category === cat) &&
        (!dest || productDestinationNames(p).includes(dest)) &&
        (!prov || p.provider?.trade_name === prov) &&
        (!s ||
          [p.name, p.internal_code, p.provider?.trade_name, ...productDestinationNames(p)]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(s))),
    );
  }, [base, q, cat, dest, prov, status]);
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
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>}
            {!isLoading && list.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay productos que coincidan con la búsqueda y los filtros.
              </p>
            )}
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATALOG_CATEGORY_LABELS[p.category]}
                    {productDestinationNames(p).length ? ` · ${productDestinationNames(p).join(", ")}` : ""}
                    {p.provider ? ` · ${p.provider.trade_name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium">
                  {p.sale_amount != null ? formatMoney(p.currency, Number(p.sale_amount)) : "Sin precio"}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
