import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/currency";
import {
  ALLOWED_DOC_TYPES,
  DOCUMENT_STATUS_CLASSES,
  DOCUMENT_STATUS_LABELS,
  MAX_DOC_BYTES,
  listSettlementDocuments,
  reviewSettlementDocument,
  settlementReason,
  submitSettlementInvoice,
  type DocumentStatus,
  type Settlement,
} from "@/lib/settlements";
import {
  getSettlementFileUrl,
  uploadSettlementFile,
} from "@/lib/settlement-files.functions";

/**
 * Facturación de una liquidación (C1.2).
 *
 * El beneficiario adjunta su factura; Administración la revisa. La factura no
 * es necesaria para generar la liquidación, pero sí para poder pagarla: al
 * aprobarla, la liquidación queda lista para pago.
 */
export function SettlementInvoicePanel({
  settlement,
  isAdmin,
  canUpload,
}: {
  settlement: Settlement;
  isAdmin: boolean;
  canUpload: boolean;
}) {
  const qc = useQueryClient();
  const upload = useServerFn(uploadSettlementFile);
  const fileUrl = useServerFn(getSettlementFileUrl);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState("");
  const [amount, setAmount] = useState(String(Number(settlement.total_commission_amount ?? 0)));
  const [notes, setNotes] = useState("");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["settlement-documents", settlement.id],
    queryFn: () => listSettlementDocuments(settlement.id),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["settlement-documents", settlement.id] });
    void qc.invalidateQueries({ queryKey: ["settlement", settlement.id] });
    void qc.invalidateQueries({ queryKey: ["settlement-history", settlement.id] });
    void qc.invalidateQueries({ queryKey: ["settlements"] });
    void qc.invalidateQueries({ queryKey: ["my-settlements"] });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Adjuntá el archivo de la factura.");
      if (!ALLOWED_DOC_TYPES.includes(file.type))
        throw new Error("Formato no permitido: sólo PDF, JPG o PNG.");
      if (file.size > MAX_DOC_BYTES) throw new Error("El archivo supera los 5 MB.");
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Importe de factura inválido.");

      const buffer = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }

      const stored = await upload({
        data: {
          settlementId: settlement.id,
          kind: "invoice",
          fileName: file.name,
          mimeType: file.type,
          content: btoa(binary),
        },
      });
      if (!stored.ok) throw new Error(settlementReason(stored.reason));

      const res = await submitSettlementInvoice({
        settlementId: settlement.id,
        filePath: stored.path,
        fileName: file.name,
        mimeType: file.type,
        fileSize: stored.size,
        invoiceNumber: number,
        invoiceDate: date || undefined,
        amount: value,
        // La moneda de la factura siempre es la de la liquidación: no hay conversión.
        currency: settlement.currency,
        invoiceKind: kind,
        notes,
      });
      if (!res.ok) throw new Error(settlementReason(res.reason));
      return res;
    },
    onSuccess: () => {
      toast.success("Factura enviada — pendiente de revisión administrativa.");
      setOpen(false);
      setFile(null);
      setNumber("");
      setDate("");
      setKind("");
      setNotes("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async (input: { id: string; approve: boolean; reason?: string }) => {
      const res = await reviewSettlementDocument(input.id, input.approve, input.reason);
      if (!res.ok) throw new Error(settlementReason(res.reason));
      return res;
    },
    onSuccess: (res) => {
      toast.success(
        res.document_status === "approved"
          ? "Factura aprobada. La liquidación quedó lista para pago."
          : "Factura rechazada. El beneficiario puede presentar una nueva.",
      );
      setRejectFor(null);
      setReason("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openFile(path: string) {
    const res = await fileUrl({ data: { path } });
    if (!res.ok) {
      toast.error(settlementReason(res.reason));
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  const status = settlement.status;
  const openForInvoice =
    status === "approved" || status === "invoice_pending" || status === "invoice_review";
  const hasPendingOrApproved = docs.some(
    (d) => d.document_type === "invoice" && (d.status === "pending_review" || d.status === "approved"),
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Facturación</h2>
        {canUpload && openForInvoice && !hasPendingOrApproved && (
          <Button size="sm" onClick={() => setOpen((v) => !v)}>
            <Upload className="mr-2 h-4 w-4" /> Subir factura
          </Button>
        )}
      </div>

      {status === "invoice_pending" && (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Falta la factura del beneficiario. Sin factura aprobada no se puede registrar el pago.
        </p>
      )}

      {open && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="invoice-file">Archivo (PDF, JPG o PNG — hasta 5 MB)</Label>
              <Input
                id="invoice-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-number">Número de factura</Label>
              <Input
                id="invoice-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="0001-00001234"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-date">Fecha de factura</Label>
              <Input
                id="invoice-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-kind">Tipo de comprobante</Label>
              <Input
                id="invoice-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                placeholder="Factura A / B / C / E (opcional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-amount">Importe en {settlement.currency}</Label>
              <Input
                id="invoice-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                La factura se declara en {settlement.currency}, igual que la liquidación.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="invoice-notes">Observaciones</Label>
              <Textarea
                id="invoice-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar factura
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay documentación presentada.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const ds = (d.status ?? "pending_review") as DocumentStatus;
            return (
              <li key={d.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {d.document_type === "invoice" ? "Factura" : "Documento"}
                      {d.invoice_number ? ` ${d.invoice_number}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.amount != null
                        ? formatMoney(d.currency ?? settlement.currency, Number(d.amount))
                        : "—"}
                      {d.invoice_date ? ` · ${d.invoice_date}` : ""}
                      {d.invoice_kind ? ` · ${d.invoice_kind}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cargada el{" "}
                      {new Date(d.uploaded_at).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                      {d.file_name ? ` · ${d.file_name}` : ""}
                    </p>
                    {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                    {ds === "rejected" && d.rejection_reason && (
                      <p className="text-xs text-destructive">Motivo: {d.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${DOCUMENT_STATUS_CLASSES[ds]}`}
                    >
                      {DOCUMENT_STATUS_LABELS[ds]}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => void openFile(d.file_path)}>
                      Ver documento
                    </Button>
                  </div>
                </div>

                {isAdmin && ds === "pending_review" && (
                  <div className="space-y-2 border-t border-border pt-3">
                    {rejectFor === d.id && (
                      <Textarea
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Motivo del rechazo (obligatorio)"
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => review.mutate({ id: d.id, approve: true })}
                        disabled={review.isPending}
                      >
                        Aprobar factura
                      </Button>
                      {rejectFor === d.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              review.mutate({ id: d.id, approve: false, reason })
                            }
                            disabled={review.isPending || !reason.trim()}
                          >
                            Confirmar rechazo
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRejectFor(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setRejectFor(d.id)}>
                          Rechazar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
