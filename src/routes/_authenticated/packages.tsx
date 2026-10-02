import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Copy, Package, Pencil, PlusCircle, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import {
  PACKAGE_TEMPLATE_STATUS_LABELS,
  duplicatePackage,
  listPackages,
  packageDestinationLabel,
  setPackageStatus,
  type PackageListRow,
} from "@/lib/packages";

export const Route = createFileRoute("/_authenticated/packages")({
  component: PackagesPage,
  head: () => ({
    meta: [
      { title: "Paquetes — ViaE Sales Hub" },
      { name: "description", content: "Plantillas reutilizables de productos del Catálogo para armar cotizaciones." },
      { property: "og:title", content: "Paquetes — ViaE Sales Hub" },
      { property: "og:description", content: "Plantillas reutilizables de productos del Catálogo para armar cotizaciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_CLASS: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  draft: "bg-secondary text-secondary-foreground",
  inactive: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground line-through",
};

function PackagesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["packages"], queryFn: listPackages });
  const refresh = () => qc.invalidateQueries({ queryKey: ["packages"] });

  const status = useMutation({
    mutationFn: (a: { id: string; s: PackageListRow["status"] }) => setPackageStatus(a.id, a.s),
    onSuccess: () => { toast.success("Estado actualizado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dup = useMutation({
    mutationFn: duplicatePackage,
    onSuccess: (id) => { toast.success("Paquete duplicado"); refresh(); navigate({ to: "/packages/$id", params: { id } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Paquetes</h1>
          <p className="text-sm text-muted-foreground">
            Combinaciones reutilizables de productos del Catálogo. No tienen precio propio: al agregarlos a una
            cotización se usan los precios actuales del Catálogo.
          </p>
        </div>
        <Button asChild>
          <Link to="/packages/$id" params={{ id: "new" }}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo paquete
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 h-6 w-6" />
          Todavía no hay paquetes.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Destino</th>
                <th className="p-3">Duración</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Productos</th>
                <th className="p-3">Último valor cotizado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0" data-testid="package-row">
                  <td className="p-3 font-medium">
                    <Link to="/packages/$id" params={{ id: p.id }} className="hover:underline">{p.name}</Link>
                  </td>
                  <td className="p-3">{packageDestinationLabel(p) || "—"}</td>
                  <td className="p-3">{p.duration_days ? `${p.duration_days} días` : "—"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[p.status]}`}>
                      {PACKAGE_TEMPLATE_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="p-3">{p.item_count}</td>
                  <td className="p-3">
                    {p.last_quoted ? (
                      <div>
                        <p className="font-medium">
                          {p.last_quoted.total_amount != null ? formatMoney(p.last_quoted.currency, p.last_quoted.total_amount) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.last_quoted.created_at).toLocaleDateString("es-AR")}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin cotizar</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild title="Editar">
                        <Link to="/packages/$id" params={{ id: p.id }}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <Button size="sm" variant="ghost" title="Duplicar" onClick={() => dup.mutate(p.id)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      {p.status !== "archived" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title={p.status === "active" ? "Desactivar" : "Activar"}
                          onClick={() => status.mutate({ id: p.id, s: p.status === "active" ? "inactive" : "active" })}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      )}
                      {p.status !== "archived" && (
                        <Button size="sm" variant="ghost" title="Archivar" onClick={() => status.mutate({ id: p.id, s: "archived" })}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
