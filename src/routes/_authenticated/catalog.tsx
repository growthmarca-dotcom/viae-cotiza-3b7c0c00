import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Library, PlusCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-account";
import { formatMoney } from "@/lib/currency";
import { CatalogProductFormDialog } from "@/components/catalog-product-form-dialog";
import {
  ACTIVE_CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  FUTURE_CATALOG_CATEGORIES,
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
  createCatalogProduct,
  listCatalogProducts,
  listCatalogProviders,
  listDestinations,
  primaryImage,
  productDestinationNames,
  type CatalogInput,
} from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/catalog")({
  component: CatalogPage,
  head: () => ({
    meta: [
      { title: "Catálogo de productos — ViaE Sales Hub" },
      { name: "description", content: "Alojamientos, excursiones y vehículos reutilizables para armar cotizaciones." },
      { property: "og:title", content: "Catálogo de productos — ViaE Sales Hub" },
      { property: "og:description", content: "Catálogo comercial de ViaE con proveedores, destinos y precios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = { active: "Activo", inactive: "Inactivo", draft: "Borrador", archived: "Archivado" };
const STATUS_CLASS: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  inactive: "bg-muted text-muted-foreground",
  draft: "bg-secondary text-secondary-foreground",
};

function CatalogPage() {
  const { isAdmin } = useAccount();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [destination, setDestination] = useState("all");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [openNew, setOpenNew] = useState(false);

  const { data: products = [], isLoading } = useQuery({ queryKey: ["catalog-products"], queryFn: listCatalogProducts });
  const { data: destinations = [] } = useQuery({ queryKey: ["destinations"], queryFn: listDestinations });
  const { data: providers = [] } = useQuery({ queryKey: ["catalog-providers"], queryFn: listCatalogProviders });

  const create = useMutation({
    mutationFn: (i: CatalogInput) => createCatalogProduct(i),
    onSuccess: (id) => {
      toast.success("Producto creado");
      setOpenNew(false);
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      navigate({ to: "/catalog/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && !(p.category === category || (category === "excursion" && p.category === "activity"))) return false;
      if (destination !== "all" && !p.destinations.some((d) => d.destination_id === destination)) return false;
      if (provider !== "all" && (provider === "none" ? p.provider_id : p.provider_id !== provider)) return false;
      if (status !== "all" && p.status !== status) return false;
      if (source !== "all" && p.source_type !== source) return false;
      if (!s) return true;
      return [p.name, p.short_description, p.internal_code, p.external_code, p.provider?.trade_name, ...productDestinationNames(p)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s));
    });
  }, [products, search, category, destination, provider, status, source]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Productos y servicios reutilizables</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Catálogo</h1>
        </div>
        <Button size="lg" onClick={() => setOpenNew(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nuevo producto
        </Button>
      </header>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative sm:col-span-2 lg:col-span-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre, código, destino o proveedor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Categoría"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {[...ACTIVE_CATALOG_CATEGORIES, ...FUTURE_CATALOG_CATEGORIES].map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={destination} onValueChange={setDestination}>
          <SelectTrigger aria-label="Destino"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los destinos</SelectItem>
            {destinations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger aria-label="Proveedor"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proveedores</SelectItem>
            <SelectItem value="none">Sin proveedor</SelectItem>
            {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.trade_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
            <SelectItem value="draft">Borradores</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger aria-label="Origen"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los orígenes</SelectItem>
            {SOURCE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3">
        {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Cargando catálogo…</p>}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Library className="mx-auto mb-3 h-6 w-6" />
            {products.length === 0 ? "El catálogo está vacío. Creá el primer producto." : "No hay productos que coincidan con los filtros."}
          </div>
        )}
        {filtered.map((p) => {
          const img = primaryImage(p);
          return (
            <Link
              key={p.id}
              to="/catalog/$id"
              params={{ id: p.id }}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary"
            >
              <div className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                {img ? <img src={img} alt={p.name} className="h-full w-full object-cover" loading="lazy" /> : <ImageOff className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[p.status] ?? ""}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {CATALOG_CATEGORY_LABELS[p.category]}
                  {" · "}
                  {productDestinationNames(p).join(", ") || "Sin destino"}
                  {" · "}
                  {p.provider?.trade_name ?? "Sin proveedor"}
                  {" · "}
                  Origen: {SOURCE_TYPE_LABELS[p.source_type]}
                </p>
              </div>
              <span className="shrink-0 text-right font-medium">
                {p.sale_amount != null ? formatMoney(p.currency, Number(p.sale_amount)) : <span className="text-sm text-muted-foreground">Sin precio</span>}
              </span>
            </Link>
          );
        })}
      </section>

      <CatalogProductFormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="Nuevo producto"
        submitting={create.isPending}
        canSeeCost={isAdmin}
        onSubmit={(i) => create.mutate(i)}
      />
    </div>
  );
}
