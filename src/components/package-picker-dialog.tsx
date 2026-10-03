import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCatalogProduct, type CatalogProduct } from "@/lib/catalog";
import { getPackage, listPackages, packageDestinationLabel } from "@/lib/packages";
import { planPackageApplication, type PackagePlan } from "@/lib/packageApply";

/**
 * "Agregar paquete": elige un paquete activo de la agencia y devuelve el plan
 * con los productos ACTUALES del Catálogo. El llamador los copia en la
 * cotización como servicios normales; la cotización no queda atada al paquete.
 */
export function PackagePickerButton({
  onApply,
}: {
  onApply: (plan: PackagePlan<CatalogProduct>, packageId: string, packageName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["packages"], queryFn: listPackages, enabled: open });
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data
      .filter((p) => p.status === "active")
      .filter((p) => !t || `${p.name} ${packageDestinationLabel(p)}`.toLowerCase().includes(t));
  }, [data, q]);

  async function pick(id: string, name: string) {
    setBusy(id);
    try {
      const full = await getPackage(id);
      if (!full) throw new Error("Paquete no encontrado.");
      const products = await Promise.all(full.items.map((it) => getCatalogProduct(it.product_id).catch(() => null)));
      const plan = planPackageApplication(
        full.items.map((it, i) => ({
          product: products[i] && products[i]!.status !== "archived" ? products[i] : null,
          component_type: it.component_type,
          quantity: Number(it.quantity),
          order_index: it.order_index,
          required: it.required,
        })),
      );
      onApply(plan, id, name);
      if (plan.missing) toast.warning(`${plan.missing} producto(s) del paquete ya no están disponibles en el Catálogo.`);
      if (plan.extraAccommodations.length)
        toast.warning("La cotización admite un solo alojamiento: se cargó el primero del paquete.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo aplicar el paquete");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Package className="mr-2 h-4 w-4" /> Agregar paquete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar paquete</DialogTitle>
            <DialogDescription>
              Se cargan sus productos con los precios actuales del Catálogo. Después podés editarlos.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar paquete" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay paquetes activos.</p>
            ) : (
              list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!!busy}
                  onClick={() => pick(p.id, p.name)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left hover:border-primary"
                  data-testid="package-option"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[packageDestinationLabel(p), p.duration_days ? `${p.duration_days} días` : "", `${p.item_count} productos`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {busy === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
