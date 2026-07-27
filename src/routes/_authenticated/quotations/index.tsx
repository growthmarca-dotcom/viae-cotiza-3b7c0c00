import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlusCircle, FileText, Eye, Pencil, Trash2, MoreVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export const Route = createFileRoute("/_authenticated/quotations/")({
  component: QuotationsPage,
  head: () => ({
    meta: [
      { title: "Cotizaciones — ViaE" },
      { name: "description", content: "Todas tus cotizaciones en un solo lugar." },
    ],
  }),
});

type Row = {
  id: string;
  created_at: string;
  destination: string | null;
  accommodation_name: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  total_amount: number | null;
  currency: string;
  status: "draft" | "sent" | "pending" | "accepted" | "rejected" | "expired";
};

const STATUS_LABEL: Record<Row["status"], string> = {
  draft: "Borrador",
  sent: "Enviada",
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};

const STATUS_STYLE: Record<Row["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-secondary text-secondary-foreground",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  accepted: "bg-primary/15 text-primary",
  rejected: "bg-destructive/15 text-destructive",
  expired: "bg-muted text-muted-foreground line-through",
};

function QuotationsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("quotations")
      .select("id, created_at, destination, accommodation_name, guest_first_name, guest_last_name, total_amount, currency, status")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setRows([]);
      return;
    }
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("quotations").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cotización eliminada");
    setToDelete(null);
    load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-semibold sm:text-4xl">Cotizaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administra tus propuestas y su estado.</p>
        </div>
        <Link to="/quotations/new">
          <Button className="shrink-0">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva
          </Button>
        </Link>
      </header>

      {rows === null ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold">Aún no tienes cotizaciones</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Crea tu primera cotización y compártela con tu cliente por un enlace único.
          </p>
          <Link to="/quotations/new" className="mt-6 inline-block">
            <Button>Crear cotización</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Destino</th>
                  <th className="px-4 py-3 font-medium">Alojamiento</th>
                  <th className="px-4 py-3 font-medium">Creada</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate({ to: "/quotations/$id", params: { id: r.id } })}
                        className="font-medium hover:text-primary"
                      >
                        {`${r.guest_first_name ?? ""} ${r.guest_last_name ?? ""}`.trim() || "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.destination ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.accommodation_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.currency} {Number(r.total_amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions row={r} onDelete={() => setToDelete(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {rows.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg font-semibold">
                      {`${r.guest_first_name ?? ""} ${r.guest_last_name ?? ""}`.trim() || "—"}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {r.destination ?? "—"} · {r.accommodation_name ?? "—"}
                    </div>
                  </div>
                  <RowActions row={r} onDelete={() => setToDelete(r)} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="text-sm font-medium">
                    {r.currency} {Number(r.total_amount ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Creada {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La cotización y sus imágenes se eliminarán permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({ row, onDelete }: { row: Row; onDelete: () => void }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate({ to: "/quotations/$id", params: { id: row.id } })}>
          <Eye className="mr-2 h-4 w-4" /> Ver
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/quotations/$id/edit", params: { id: row.id } })}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
