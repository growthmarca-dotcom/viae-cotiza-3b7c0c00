import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  ExternalLink,
  History as HistoryIcon,
  Loader2,
  Pencil,
  Share2,
  Trash2,
  TicketCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { duplicateQuotation, setQuotationArchived, signImageUrls } from "@/lib/quotations";
import { DEFAULT_COMPANY, fetchCompany, type CompanyInfo } from "@/lib/company";
import { QuotationPrintDocument } from "@/components/quotation-print";
import { convertTotals, formatMoney } from "@/lib/currency";
import { QuotationItemsSummary } from "@/components/quotation-items-summary";
import {
  listQuotationItems,
  rowToDraft,
  rowsTotal,
  type QuotationItemRow,
} from "@/lib/quotationItems";
import { QuotationConvertDialog } from "@/components/quotation-convert-dialog";
import { getBookingByQuotation, type Booking } from "@/lib/bookings";
import {
  canTransition,
  setQuotationStatus,
  STATUS_LABEL,
  STATUS_STYLE,
  type QuotationStatus,
} from "@/lib/quotationStatus";

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
  if (action === "converted_to_booking") return "Convertida en reserva";
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
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [items, setItems] = useState<QuotationItemRow[]>([]);
  const [statusBusy, setStatusBusy] = useState<QuotationStatus | null>(null);

  async function loadBooking() {
    try {
      setBooking(await getBookingByQuotation(id));
    } catch {
      setBooking(null);
    }
  }

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
      try {
        setItems(await listQuotationItems(id));
      } catch {
        setItems([]);
      }
      const { info } = await fetchCompany();
      setCompany(info);
      await loadHistory();
      await loadBooking();
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
  const totals = convertTotals(q.total_amount, q.currency, q.exchange_rate);


  async function copyShare() {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Enlace copiado");
  }

  async function handleDuplicate() {
    try {
      const newId = await duplicateQuotation(id);
      toast.success("Cotización duplicada");
      navigate({ to: "/quotations/$id/edit", params: { id: newId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar");
    }
  }

  async function handleArchive() {
    if (!q) return;
    try {
      await setQuotationArchived(id, !q.archived);
      toast.success(q.archived ? "Cotización desarchivada" : "Cotización archivada");
      setQ({ ...q, archived: !q.archived });
      loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo archivar");
    }
  }


  async function changeStatus(to: QuotationStatus) {
    if (!q) return;
    setStatusBusy(to);
    try {
      await setQuotationStatus(q.id, q.status, to);
      const { data } = await supabase.from("quotations").select("*").eq("id", q.id).maybeSingle();
      if (data) setQ(data as Q);
      toast.success(`Cotización marcada como ${STATUS_LABEL[to].toLowerCase()}`);
      loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    } finally {
      setStatusBusy(null);
    }
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
    <QuotationPrintDocument quotation={q} company={company} imageUrls={urls} items={items} />
    <div className="mx-auto max-w-4xl space-y-6 pb-24 print-screen-hide">
      <Link to="/quotations" data-print-hide className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a cotizaciones
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {q.quotation_number ? (
            <p className="text-sm font-medium tracking-wide text-primary">
              Cotización {q.quotation_number}
            </p>
          ) : null}
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
          {booking ? (
            <Button variant="outline" onClick={() => navigate({ to: "/bookings/$id", params: { id: booking.id } })}>
              <TicketCheck className="mr-2 h-4 w-4" /> Reserva creada · Abrir {booking.booking_number}
            </Button>
          ) : q.status === "accepted" ? (
            <Button
              onClick={() => {
                if (!q.client_id) {
                  toast.error("Asociá un cliente a la cotización antes de generar la reserva.");
                  return;
                }
                setBookingOpen(true);
              }}
            >
              <TicketCheck className="mr-2 h-4 w-4" /> Convertir a reserva
            </Button>
          ) : null}
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
          </Button>
        </div>
      </header>

      {/* Ciclo comercial de la cotización */}
      <div data-print-hide className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">Estado comercial</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[q.status]}`}>
                {STATUS_LABEL[q.status]}
              </span>
              {q.sent_at && <span>Enviada {new Date(q.sent_at).toLocaleString()}</span>}
              {q.accepted_at && <span>Aceptada {new Date(q.accepted_at).toLocaleString()}</span>}
              {q.rejected_at && <span>Rechazada {new Date(q.rejected_at).toLocaleString()}</span>}
              {q.expires_at && <span>Válida hasta {new Date(q.expires_at).toLocaleDateString()}</span>}
              {q.client_responded_at && (
                <span className="font-medium text-foreground">
                  Respondida por el cliente desde el enlace público{" "}
                  {new Date(q.client_responded_at).toLocaleString()}
                </span>
              )}
            </div>
            {q.client_response_note && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                Comentario del cliente: “{q.client_response_note}”
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["sent", "accepted", "rejected"] as QuotationStatus[]).map((to) => (
              <Button
                key={to}
                size="sm"
                variant={to === "rejected" ? "outline" : to === "accepted" ? "default" : "outline"}
                disabled={!canTransition(q.status, to) || q.status === to || statusBusy !== null}
                onClick={() => changeStatus(to)}
                className={to === "rejected" ? "text-destructive hover:text-destructive" : undefined}
              >
                {statusBusy === to && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {to === "sent"
                  ? "Marcar como enviada"
                  : to === "accepted"
                    ? "Marcar como aceptada"
                    : "Marcar como rechazada"}
              </Button>
            ))}
          </div>
        </div>
        {q.status === "accepted" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Una cotización aceptada es definitiva: no puede volver a borrador ni cambiar de estado.
          </p>
        )}
      </div>

      {q.client_id && q.status === "accepted" && !booking && (
        <QuotationConvertDialog
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          summary={{
            quotationId: q.id,
            quotationNumber: q.quotation_number ?? null,
            clientId: q.client_id,
            clientName: guestName,
            destination: q.destination,
            travelStart: q.travel_start,
            travelEnd: q.travel_end,
            paxCount: q.pax_count ?? null,
            servicesCount: items.length,
            amount: Number(q.total_amount ?? 0),
            currency: q.currency,
            exchangeRate: q.exchange_rate,
          }}
          onConverted={async (bookingId) => {
            await loadBooking();
            loadHistory();
            toast.success("Reserva creada correctamente.");
            navigate({ to: "/bookings/$id", params: { id: bookingId } });
          }}
        />
      )}



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
        <Row label="Otros cargos" value={q.other_charges != null ? `${q.currency} ${q.other_charges}` : null} />
        <Row label="Total" value={`${q.currency} ${Number(q.total_amount ?? 0).toLocaleString()}`} />
        <Row label="Moneda utilizada" value={q.currency} />
        <Row
          label="Tipo de cambio utilizado"
          value={totals.rate != null ? `1 USD = ARS ${totals.rate.toLocaleString("es-AR")}` : null}
        />
        <Row label="Total en USD" value={totals.totalUsd != null ? formatMoney("USD", totals.totalUsd) : null} />
        <Row label="Total en ARS" value={totals.totalArs != null ? formatMoney("ARS", totals.totalArs) : null} />
        <Row label="Fecha de la cotización" value={new Date(q.created_at).toLocaleDateString()} />
      </Card>


      {items.length > 0 && (
        <QuotationItemsSummary
          currency={q.currency}
          items={items.map(rowToDraft)}
          extraLines={
            Number(q.total_amount ?? 0) - rowsTotal(items) !== 0
              ? [
                  {
                    label: q.accommodation_name ?? "Alojamiento y cargos",
                    amount: Number(q.total_amount ?? 0) - rowsTotal(items),
                  },
                ]
              : []
          }
          title="Resumen general de la cotización"
        />
      )}

      {q.notes && (
        <Card title="Observaciones">
          <Row label="" value={q.notes} multiline />
        </Card>
      )}

      <div data-print-hide className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <HistoryIcon className="h-4 w-4 text-gold" /> Historial de modificaciones
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
