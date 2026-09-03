import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Loader2, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/currency";
import {
  ADJUSTMENT_REASONS,
  ADJUSTMENT_STATUS_CLASSES,
  ADJUSTMENT_STATUS_LABELS,
  ALLOWED_DOC_TYPES,
  DOCUMENT_STATUS_CLASSES,
  DOCUMENT_STATUS_LABELS,
  MAX_DOC_BYTES,
  adjustmentReasonLabel,
  applyAdjustmentBalance,
  createAdjustment,
  documentTypeLabel,
  getPayableAmount,
  listAvailableBalances,
  listSettlementAdjustments,
  listSettlementApplications,
  listSettlementDocuments,
  reviewAdjustment,
  settlementReason,
  submitSettlementInvoice,
  type AdjustmentReason,
  type AdjustmentStatus,
  type AdjustmentType,
  type DocumentStatus,
  type Settlement,
} from "@/lib/settlements";
import { uploadSettlementFile } from "@/lib/settlement-files.functions";

/**
 * Ajustes, saldos y notas de crédito/débito (C1.3).
 *
 * Nada de esto edita la liquidación, la comisión ni el pago: cada corrección es
 * un movimiento nuevo. Antes del pago el ajuste cambia el importe a pagar;
 * después del pago genera un saldo que se aplica manualmente a una liquidación
 * futura del mismo beneficiario y la misma moneda.
 */
export function SettlementAdjustmentsPanel({
  settlement,
  isAdmin,
}: {
  settlement: Settlement;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const upload = useServerFn(uploadSettlementFile);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AdjustmentType>("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<AdjustmentReason>("commission_calculation_error");
  const [notes, setNotes] = useState("");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteNumber, setNoteNumber] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [noteAmount, setNoteAmount] = useState("");
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [applyAmounts, setApplyAmounts] = useState<Record<string, string>>({});
  // Idempotencia frente a doble click / reintento: una clave por intento de alta.
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ["settlement-adjustments", settlement.id],
    queryFn: () => listSettlementAdjustments(settlement.id),
  });
  const { data: applications = [] } = useQuery({
    queryKey: ["settlement-applications", settlement.id],
    queryFn: () => listSettlementApplications(settlement.id),
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["settlement-documents", settlement.id],
    queryFn: () => listSettlementDocuments(settlement.id),
  });
  const { data: payable = 0 } = useQuery({
    queryKey: ["settlement-payable", settlement.id],
    queryFn: () => getPayableAmount(settlement.id),
  });
  const { data: balances = [] } = useQuery({
    queryKey: [
      "adjustment-balances",
      settlement.beneficiary_type,
      settlement.beneficiary_id,
      settlement.currency,
    ],
    queryFn: () =>
      listAvailableBalances({
        beneficiaryType: settlement.beneficiary_type,
        beneficiaryId: settlement.beneficiary_id,
        currency: settlement.currency,
      }),
  });

  const invalidate = () => {
    for (const key of [
      "settlement-adjustments",
      "settlement-applications",
      "settlement-documents",
      "settlement-payable",
      "settlement-adjustment-history",
    ]) {
      void qc.invalidateQueries({ queryKey: [key, settlement.id] });
    }
    void qc.invalidateQueries({ queryKey: ["adjustment-balances"] });
    void qc.invalidateQueries({ queryKey: ["settlement", settlement.id] });
  };

  const totals = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const a of adjustments) {
      if (a.status !== "approved") continue;
      if (a.adjustment_type === "credit") credits += Number(a.amount);
      else debits += Number(a.amount);
    }
    return { credits, debits };
  }, [adjustments]);

  const create = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Importe de ajuste inválido.");
      if (reason === "other" && !notes.trim())
        throw new Error("Si el motivo es «Otro», la descripción es obligatoria.");
      const res = await createAdjustment({
        settlementId: settlement.id,
        adjustmentType: type,
        amount: value,
        reason,
        notes,
        currency: settlement.currency,
        idempotencyKey: idempotencyKey.current,
      });
      if (!res.ok) throw new Error(settlementReason(res.reason));
      return res;
    },
    onSuccess: () => {
      toast.success("Ajuste creado — pendiente de aprobación administrativa.");
      setOpen(false);
      setAmount("");
      setNotes("");
      idempotencyKey.current = crypto.randomUUID();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async (input: { id: string; approve: boolean; reason?: string }) => {
      const res = await reviewAdjustment(input.id, input.approve, input.reason);
      if (!res.ok) throw new Error(settlementReason(res.reason));
      return res;
    },
    onSuccess: (res) => {
      toast.success(
        res.status === "approved"
          ? res.creates_balance
            ? "Ajuste aprobado. Se generó un saldo para una liquidación futura."
            : "Ajuste aprobado. Cambió el importe a pagar."
          : "Ajuste rechazado.",
      );
      setRejectFor(null);
      setRejectReason("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: async (input: { adjustmentId: string; amount: number }) => {
      const res = await applyAdjustmentBalance(input.adjustmentId, settlement.id, input.amount);
      if (!res.ok) throw new Error(settlementReason(res.reason));
      return res;
    },
    onSuccess: () => {
      toast.success("Saldo aplicado a esta liquidación.");
      setApplyAmounts({});
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitNote = useMutation({
    mutationFn: async (adjustmentId: string) => {
      const adj = adjustments.find((a) => a.id === adjustmentId);
      if (!adj) throw new Error("Ajuste no encontrado.");
      if (!noteFile) throw new Error("Adjuntá el archivo de la nota.");
      if (!ALLOWED_DOC_TYPES.includes(noteFile.type))
        throw new Error("Formato no permitido: sólo PDF, JPG o PNG.");
      if (noteFile.size > MAX_DOC_BYTES) throw new Error("El archivo supera los 5 MB.");
      const value = Number(noteAmount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Importe de la nota inválido.");

      const bytes = new Uint8Array(await noteFile.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const stored = await upload({
        data: {
          settlementId: settlement.id,
          kind: "note",
          fileName: noteFile.name,
          mimeType: noteFile.type,
          content: btoa(binary),
        },
      });
      if (!stored.ok) throw new Error(settlementReason(stored.reason));

      const res = await submitSettlementInvoice({
        settlementId: settlement.id,
        filePath: stored.path,
        fileName: noteFile.name,
        mimeType: noteFile.type,
        fileSize: stored.size,
        invoiceNumber: noteNumber,
        invoiceDate: noteDate || undefined,
        amount: value,
        // Misma moneda que la liquidación: no hay conversión en ningún caso.
        currency: settlement.currency,
        documentType: adj.adjustment_type === "credit" ? "credit_note" : "debit_note",
        adjustmentId,
      });
      if (!res.ok) throw new Error(settlementReason(res.reason));
      return res;
    },
    onSuccess: () => {
      toast.success("Nota registrada — pendiente de revisión.");
      setNoteFor(null);
      setNoteFile(null);
      setNoteNumber("");
      setNoteDate("");
      setNoteAmount("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notes_docs = docs.filter(
    (d) => d.document_type === "credit_note" || d.document_type === "debit_note",
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Ajustes y saldos</h2>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo ajuste
          </Button>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Importe original</p>
          <p className="font-display text-base font-semibold">
            {formatMoney(settlement.currency, Number(settlement.total_commission_amount ?? 0))}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Créditos aprobados</p>
          <p className="font-display text-base font-semibold text-destructive">
            − {formatMoney(settlement.currency, totals.credits)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Débitos aprobados</p>
          <p className="font-display text-base font-semibold">
            + {formatMoney(settlement.currency, totals.debits)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Importe final a pagar</p>
          <p className="font-display text-base font-semibold">
            {formatMoney(settlement.currency, payable)}
          </p>
        </div>
      </div>

      {open && isAdmin && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de ajuste</Label>
              <Select value={type} onValueChange={(v) => setType(v as AdjustmentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Crédito — reduce lo que ViaE debe</SelectItem>
                  <SelectItem value="debit">Débito — aumenta lo que ViaE debe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-amount">Importe en {settlement.currency}</Label>
              <Input
                id="adj-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Siempre positivo: el signo lo define el tipo de ajuste.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="adj-notes">
                Descripción {reason === "other" ? "(obligatoria)" : "(opcional)"}
              </Label>
              <Textarea
                id="adj-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Si la liquidación ya fue pagada, el ajuste no la modifica: genera un saldo aplicable a
            una liquidación futura en {settlement.currency}.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear ajuste
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : adjustments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta liquidación no tiene ajustes.</p>
      ) : (
        <ul className="space-y-2">
          {adjustments.map((a) => {
            const st = a.status as AdjustmentStatus;
            const noteDoc = notes_docs.find((d) => d.adjustment_id === a.id);
            return (
              <li key={a.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">
                      {a.adjustment_type === "credit" ? "Crédito" : "Débito"}{" "}
                      {formatMoney(a.currency, Number(a.amount))}
                      {!a.affects_payment ? " · genera saldo" : " · afecta el pago"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {adjustmentReasonLabel(a.reason)} ·{" "}
                      {new Date(a.created_at).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                    {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                    {st === "rejected" && a.rejection_reason && (
                      <p className="text-xs text-destructive">Motivo: {a.rejection_reason}</p>
                    )}
                    {noteDoc && (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        {documentTypeLabel(noteDoc.document_type)}
                        {noteDoc.invoice_number ? ` ${noteDoc.invoice_number}` : ""} ·{" "}
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            DOCUMENT_STATUS_CLASSES[(noteDoc.status ?? "pending_review") as DocumentStatus]
                          }`}
                        >
                          {DOCUMENT_STATUS_LABELS[(noteDoc.status ?? "pending_review") as DocumentStatus]}
                        </span>
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${ADJUSTMENT_STATUS_CLASSES[st]}`}
                  >
                    {ADJUSTMENT_STATUS_LABELS[st]}
                  </span>
                </div>

                {isAdmin && st === "pending_approval" && (
                  <div className="space-y-2 border-t border-border pt-3">
                    {rejectFor === a.id && (
                      <Textarea
                        rows={2}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Motivo del rechazo (obligatorio)"
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => review.mutate({ id: a.id, approve: true })}
                        disabled={review.isPending}
                      >
                        Aprobar ajuste
                      </Button>
                      {rejectFor === a.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              review.mutate({ id: a.id, approve: false, reason: rejectReason })
                            }
                            disabled={review.isPending || !rejectReason.trim()}
                          >
                            Confirmar rechazo
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRejectFor(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setRejectFor(a.id)}>
                          Rechazar
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {st === "approved" && !noteDoc && (
                  <div className="space-y-2 border-t border-border pt-3">
                    {noteFor === a.id ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor={`note-file-${a.id}`}>
                              Archivo de la nota (PDF, JPG o PNG — hasta 5 MB)
                            </Label>
                            <Input
                              id={`note-file-${a.id}`}
                              type="file"
                              accept="application/pdf,image/jpeg,image/png"
                              onChange={(e) => setNoteFile(e.target.files?.[0] ?? null)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`note-number-${a.id}`}>Número</Label>
                            <Input
                              id={`note-number-${a.id}`}
                              value={noteNumber}
                              onChange={(e) => setNoteNumber(e.target.value)}
                              placeholder="0001-00000123"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`note-date-${a.id}`}>Fecha</Label>
                            <Input
                              id={`note-date-${a.id}`}
                              type="date"
                              value={noteDate}
                              onChange={(e) => setNoteDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`note-amount-${a.id}`}>
                              Importe en {settlement.currency}
                            </Label>
                            <Input
                              id={`note-amount-${a.id}`}
                              inputMode="decimal"
                              value={noteAmount}
                              onChange={(e) => setNoteAmount(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => submitNote.mutate(a.id)}
                            disabled={submitNote.isPending}
                          >
                            {submitNote.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Registrar nota
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setNoteFor(null)}>
                            Cancelar
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ViaE no emite el documento fiscal: se registra el que se emitió por fuera.
                        </p>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNoteFor(a.id);
                          setNoteAmount(String(Number(a.amount)));
                        }}
                      >
                        Registrar {a.adjustment_type === "credit" ? "nota de crédito" : "nota de débito"}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {applications.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Saldos aplicados a esta liquidación</h3>
          <ul className="space-y-2">
            {applications.map((ap) => (
              <li
                key={ap.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm"
              >
                <span className="text-muted-foreground">
                  Aplicado el{" "}
                  {new Date(ap.applied_at).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="font-display font-semibold">
                  {formatMoney(ap.currency, Number(ap.amount_applied))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAdmin && settlement.status !== "settled" && balances.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Scale className="h-4 w-4 text-muted-foreground" />
            Saldos disponibles en {settlement.currency}
          </h3>
          <p className="text-xs text-muted-foreground">
            Sólo del mismo beneficiario y la misma moneda. La aplicación es manual y queda
            registrada.
          </p>
          <ul className="space-y-2">
            {balances
              .filter((b) => b.origin_settlement_id !== settlement.id)
              .map((b) => (
                <li
                  key={b.adjustment_id}
                  className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {b.adjustment_type === "debit"
                        ? "Saldo a favor del beneficiario"
                        : "Saldo a favor de ViaE"}{" "}
                      · {formatMoney(b.currency, Number(b.remaining_amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {adjustmentReasonLabel(b.reason)} · Original{" "}
                      {formatMoney(b.currency, Number(b.amount))}
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`apply-${b.adjustment_id}`} className="text-xs">
                        Importe a aplicar
                      </Label>
                      <Input
                        id={`apply-${b.adjustment_id}`}
                        className="w-32"
                        inputMode="decimal"
                        value={applyAmounts[b.adjustment_id] ?? String(Number(b.remaining_amount))}
                        onChange={(e) =>
                          setApplyAmounts((prev) => ({
                            ...prev,
                            [b.adjustment_id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        apply.mutate({
                          adjustmentId: b.adjustment_id,
                          amount: Number(
                            applyAmounts[b.adjustment_id] ?? String(Number(b.remaining_amount)),
                          ),
                        })
                      }
                      disabled={apply.isPending}
                    >
                      Aplicar
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
