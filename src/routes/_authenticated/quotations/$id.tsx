import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Download, ExternalLink, Loader2, Pencil, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { signImageUrls } from "@/lib/quotations";
import type { Tables } from "@/integrations/supabase/types";
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

export const Route = createFileRoute("/_authenticated/quotations/$id")({
  component: QuotationDetailPage,
  head: () => ({
    meta: [
      { title: "Detalle de cotización — ViaE Sales Hub" },
      { name: "description", content: "Detalle completo de la cotización." },
    ],
  }),
});

type Q = Tables<"quotations">;

type HistoryEntry = { id: string; action: string; created_at: string };

function describeHistory(action: string) {
  if (action === "created") return "Cotización creada";
  if (action === "updated") return "Cotización actualizada";
  if (action === "archived") return "Cotización archivada";
  if (action === "unarchived") return "Cotización desarchivada";
  if (action === "duplicated") return "Cotización duplicada";
  return action;
}

function QuotationDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState<Q | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [company, setCompany] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  async function loadHistory() {
    const { data } = await supabase
      .from("quotation_history")
      .select("id, action, created_at")
      .eq("quotation_id", id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data ?? []) as HistoryEntry[]);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        toast.error(error?.message ?? "Cotización no encontrada");
        setLoading(false);
        return;
      }
      setQ(data as Q);
      const signed = await signImageUrls(data.images ?? []);
      setUrls(signed);
      const { info } = await fetchCompany();
      setCompany(info);
      await loadHistory();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando...
      </div>
    );
  }
  if (!q) return null;

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/cotizacion/${q.share_token}`;
  const guestName = `${q.guest_first_name ?? ""} ${q.guest_last_name ?? ""}`.trim() || "—";

  async function copyShare() {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Enlace copiado");
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("quotations").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cotización eliminada");
    navigate({ to: "/quotations" });
  }

  return (
    <>
    <QuotationPrintDocument quotation={q} company={company} imageUrls={urls} />
    <div className="mx-auto max-w-4xl space-y-6 pb-24 print-screen-hide">
      <Link to="/quotations" data-print-hide className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a cotizaciones
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{q.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {q.destination ?? "Sin destino"} · Creada {new Date(q.created_at).toLocaleDateString()}
            {q.archived ? " · Archivada" : ""}
          </p>
        </div>
        <div data-print-hide className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" /> Descargar PDF
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/quotations/$id/edit", params: { id } })}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
          <Button variant="outline" onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" /> Duplicar
          </Button>
          <Button variant="outline" onClick={handleArchive}>
            {q.archived ? (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" /> Desarchivar
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" /> Archivar
              </>
            )}
          </Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
          </Button>
        </div>
      </header>


      {/* Share card */}
      <div data-print-hide className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <Share2 className="h-4 w-4 text-primary" /> Enlace público
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{shareUrl}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyShare}>
              <Copy className="mr-2 h-4 w-4" /> Copiar
            </Button>
            <a href={shareUrl} target="_blank" rel="noreferrer">
              <Button size="sm">
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir
              </Button>
            </a>
          </div>
        </div>
      </div>

      {urls.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {urls.map((u, i) => (
            <div key={u} className="aspect-square overflow-hidden rounded-xl border border-border">
              <img src={u} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <Card title="Datos del cliente">
        <Row label="Nombre" value={guestName} />
        <Row label="Email" value={q.guest_email} />
        <Row label="WhatsApp" value={q.guest_whatsapp} />
      </Card>

      <Card title="Viaje">
        <Row label="Destino" value={q.destination} />
        <Row label="Ingreso" value={q.travel_start} />
        <Row label="Salida" value={q.travel_end} />
        <Row label="Noches" value={q.nights} />
        <Row label="Pasajeros" value={q.pax_count} />
      </Card>

      <Card title="Alojamiento">
        <Row label="Nombre" value={q.accommodation_name} />
        <Row label="Dirección" value={q.accommodation_address} />
        <Row label="Descripción" value={q.accommodation_description} multiline />
        <Row label="Servicios" value={q.accommodation_services} multiline />
        <Row label="Política de cancelación" value={q.cancellation_policy} multiline />
      </Card>

      <Card title="Precios">
        <Row label="Precio por noche" value={q.price_per_night != null ? `${q.currency} ${q.price_per_night}` : null} />
        <Row label="Impuestos" value={q.taxes != null ? `${q.currency} ${q.taxes}` : null} />
        <Row label="Total" value={`${q.currency} ${Number(q.total_amount ?? 0).toLocaleString()}`} />
      </Card>

      {q.notes && (
        <Card title="Observaciones">
          <Row label="" value={q.notes} multiline />
        </Card>
      )}

      <div data-print-hide className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <History className="h-4 w-4 text-gold" /> Historial de modificaciones
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          {history.length === 0 && (
            <li className="text-muted-foreground">Sin modificaciones registradas todavía.</li>
          )}
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
              <span>{describeHistory(h.action)}</span>
              <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
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
    </>
  );

}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 font-display text-xl font-semibold">{title}</h2>
      <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: unknown; multiline?: boolean }) {
  const v = value == null || value === "" ? "—" : String(value);
  return (
    <div className={multiline ? "sm:col-span-2" : ""}>
      {label && <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>}
      <dd className={`mt-1 text-sm ${multiline ? "whitespace-pre-wrap" : ""}`}>{v}</dd>
    </div>
  );
}
