import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, FileText, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAccount } from "@/hooks/use-account";
import { formatMoney } from "@/lib/currency";
import { CatalogProductFormDialog } from "@/components/catalog-product-form-dialog";
import {
  CATALOG_CATEGORY_LABELS,
  PROVIDER_SOURCE_KIND_LABELS,
  SOURCE_TYPE_LABELS,
  deleteCatalogProduct,
  duplicateCatalogProduct,
  getCatalogProduct,
  productDestinationNames,
  productToInput,
  setCatalogProductStatus,
  updateCatalogProduct,
  type CatalogInput,
} from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/catalog_/$id")({
  component: ProductPage,
  head: () => ({
    meta: [
      { title: "Ficha de producto — ViaE Sales Hub" },
      { name: "description", content: "Información completa de un producto del catálogo de ViaE." },
      { property: "og:title", content: "Ficha de producto — ViaE Sales Hub" },
      { property: "og:description", content: "Datos comerciales, destinos, proveedor e imágenes del producto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const META_LABELS: Record<string, string> = {
  accommodation_type: "Tipo de alojamiento",
  stars: "Categoría / estrellas",
  address: "Dirección",
  maps_url: "Ubicación",
  website: "Sitio web",
  services: "Servicios",
  policies: "Políticas",
  check_in: "Check-in",
  check_out: "Check-out",
  duration: "Duración",
  includes: "Incluye",
  excludes: "No incluye",
  requirements: "Requisitos",
  brand: "Marca",
  model: "Modelo",
  vehicle_category: "Categoría",
  vehicle_type: "Tipo de vehículo",
  passengers: "Pasajeros",
  luggage: "Equipaje",
  transmission: "Transmisión",
  fuel: "Combustible",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm">{value || "—"}</dd>
    </div>
  );
}

function ProductPage() {
  const { id } = Route.useParams();
  const { isAdmin } = useAccount();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: p, isLoading } = useQuery({ queryKey: ["catalog-product", id], queryFn: () => getCatalogProduct(id) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["catalog-product", id] });
    qc.invalidateQueries({ queryKey: ["catalog-products"] });
  };

  const save = useMutation({
    mutationFn: (i: CatalogInput) => updateCatalogProduct(id, i),
    onSuccess: () => { toast.success("Producto actualizado"); setEdit(false); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: () => setCatalogProductStatus(id, p?.status === "active" ? "inactive" : "active"),
    onSuccess: () => { toast.success(p?.status === "active" ? "Producto desactivado" : "Producto activado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dup = useMutation({
    mutationFn: () => duplicateCatalogProduct(p!),
    onSuccess: (newId) => { toast.success("Producto duplicado como borrador"); refresh(); navigate({ to: "/catalog/$id", params: { id: newId } }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => deleteCatalogProduct(id),
    onSuccess: () => { toast.success("Producto eliminado"); qc.invalidateQueries({ queryKey: ["catalog-products"] }); navigate({ to: "/catalog" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>;
  if (!p) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Producto no encontrado. <Link to="/catalog" className="underline">Volver al catálogo</Link>
      </div>
    );
  }

  const meta = (p.metadata ?? {}) as Record<string, unknown>;
  const metaEntries = Object.entries(meta).filter(([k, v]) => META_LABELS[k] && String(v ?? "").trim() !== "");
  const images = [...p.media].filter((m) => m.type === "image").sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.order_index - b.order_index);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <Link to="/catalog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {CATALOG_CATEGORY_LABELS[p.category]} · {p.status === "active" ? "Activo" : p.status === "draft" ? "Borrador" : "Inactivo"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{p.name}</h1>
          {p.short_description && <p className="mt-2 text-muted-foreground">{p.short_description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => navigate({ to: "/quotations/new", search: { catalogProductId: p.id } })}
            disabled={p.status !== "active"}
            title={p.status !== "active" ? "Activá el producto para usarlo en cotizaciones" : undefined}
          >
            <FileText className="mr-2 h-4 w-4" /> Utilizar en cotización
          </Button>
          <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
          <Button variant="outline" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
            <Power className="mr-2 h-4 w-4" /> {p.status === "active" ? "Desactivar" : "Activar"}
          </Button>
          <Button variant="outline" onClick={() => dup.mutate()} disabled={dup.isPending}><Copy className="mr-2 h-4 w-4" /> Duplicar</Button>
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
          </Button>
        </div>
      </header>

      {images.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {images.map((m, i) => (
            <img key={m.id} src={m.url} alt={`${p.name} — imagen ${i + 1}`} loading="lazy" className={`w-full rounded-xl object-cover ${i === 0 ? "aspect-video sm:col-span-2 sm:row-span-2" : "aspect-video"}`} />
          ))}
        </div>
      )}

      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-3">
        <Row label="Precio de venta" value={p.sale_amount != null ? formatMoney(p.currency, Number(p.sale_amount)) : null} />
        {isAdmin && <Row label="Costo del proveedor" value={p.cost_amount != null ? formatMoney(p.currency, Number(p.cost_amount)) : null} />}
        <Row label="Moneda" value={p.currency} />
        <Row label="Proveedor / fuente" value={p.provider ? `${p.provider.trade_name} · ${PROVIDER_SOURCE_KIND_LABELS[p.provider.source_kind] ?? ""}` : null} />
        <Row label="Destinos" value={productDestinationNames(p).join(", ")} />
        <Row label="Origen" value={SOURCE_TYPE_LABELS[p.source_type]} />
        <Row label="Código interno" value={p.internal_code} />
        <Row label="Código externo" value={p.external_code} />
        <Row label="Última sincronización" value={p.last_synced_at ? new Date(p.last_synced_at).toLocaleString("es-AR") : "No aplica (sin integración)"} />
      </section>

      {(p.description || metaEntries.length > 0) && (
        <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {p.description && <Row label="Descripción" value={p.description} />}
          {metaEntries.length > 0 && (
            <dl className="grid gap-6 sm:grid-cols-2">
              {metaEntries.map(([k, v]) => (
                <Row
                  key={k}
                  label={META_LABELS[k]}
                  value={/^https?:\/\//.test(String(v)) ? <a href={String(v)} target="_blank" rel="noreferrer" className="underline">{String(v)}</a> : String(v)}
                />
              ))}
            </dl>
          )}
        </section>
      )}

      {p.internal_notes && (
        <section className="rounded-2xl border border-border bg-secondary/40 p-6">
          <Row label="Observaciones internas" value={p.internal_notes} />
        </section>
      )}

      <CatalogProductFormDialog
        open={edit}
        onOpenChange={setEdit}
        title="Editar producto"
        initial={productToInput(p)}
        submitting={save.isPending}
        canSeeCost={isAdmin}
        onSubmit={(i) => save.mutate(i)}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Las cotizaciones que ya lo usaron no cambian: conservan su copia de los datos. Si preferís conservarlo, desactivalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
