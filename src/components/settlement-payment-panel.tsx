import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
  ALLOWED_DOC_TYPES,
  MAX_DOC_BYTES,
  PAYMENT_METHODS,
  getPayableAmount,
  getSettlementPayment,
  paymentMethodLabel,
  recordSettlementPayment,
  settlementReason,
  type PaymentMethod,
  type Settlement,
} from "@/lib/settlements";
import {
  getSettlementFileUrl,
  uploadSettlementFile,
} from "@/lib/settlement-files.functions";

/**
 * Registro del pago (C1.2). El sistema NO paga: sólo registra que el pago se
 * hizo por fuera. El importe debe coincidir exactamente con el total de la
 * liquidación — no hay pagos parciales ni múltiples.
 */
export function SettlementPaymentPanel({
  settlement,
  isAdmin,
}: {
  settlement: Settlement;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const upload = useServerFn(uploadSettlementFile);
  const fileUrl = useServerFn(getSettlementFileUrl);

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // null = todavía sin editar: se usa el importe final calculado por la base.
  const [amount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);

  const { data: payment } = useQuery({
    queryKey: ["settlement-payment", settlement.id],
    queryFn: () => getSettlementPayment(settlement.id),
  });

  // El importe a pagar lo define la base: total original ± ajustes y saldos aplicados.
  const { data: payable = 0 } = useQuery({
    queryKey: ["settlement-payable", settlement.id],
    queryFn: () => getPayableAmount(settlement.id),
  });
  const total = payable;

  const record = useMutation({
    mutationFn: async () => {
      const value = Number(amount ?? String(total));
      if (!Number.isFinite(value)) throw new Error("Importe inválido.");
      if (Math.round(value * 100) !== Math.round(total * 100))
        throw new Error("El importe debe ser exactamente igual al total de la liquidación.");

      let proofPath: string | undefined;
      if (proof) {
        if (!ALLOWED_DOC_TYPES.includes(proof.type))
          throw new Error("Comprobante no permitido: sólo PDF, JPG o PNG.");
        if (proof.size > MAX_DOC_BYTES) throw new Error("El comprobante supera los 5 MB.");
        const bytes = new Uint8Array(await proof.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        const stored = await upload({
          data: {
            settlementId: settlement.id,
            kind: "payment_proof",
            fileName: proof.name,
            mimeType: proof.type,
            content: btoa(binary),
          },
        });
        if (!stored.ok) throw new Error(settlementReason(stored.reason));
        proofPath = stored.path;
      }

      const res = await recordSettlementPayment({
        settlementId: settlement.id,
        amount: value,
        currency: settlement.currency,
        paymentDate: date,
        paymentMethod: method,
        paymentReference: reference,
        paymentProofPath: proofPath,
        notes,
      });
      if (!res.ok) throw new Error(settlementReason(res.reason));
      return res;
    },
    onSuccess: () => {
      toast.success("Pago registrado. La liquidación quedó pagada.");
      setOpen(false);
      setProof(null);
      void qc.invalidateQueries({ queryKey: ["settlement-payment", settlement.id] });
      void qc.invalidateQueries({ queryKey: ["settlement-payable", settlement.id] });
      void qc.invalidateQueries({ queryKey: ["settlement", settlement.id] });
      void qc.invalidateQueries({ queryKey: ["settlement-history", settlement.id] });
      void qc.invalidateQueries({ queryKey: ["settlements"] });
      void qc.invalidateQueries({ queryKey: ["my-settlements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openProof(path: string) {
    const res = await fileUrl({ data: { path } });
    if (!res.ok) {
      toast.error(settlementReason(res.reason));
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">Pago</h2>

      {payment ? (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-xl font-semibold">
            {formatMoney(payment.currency, Number(payment.amount))}
          </p>
          <p className="text-sm text-muted-foreground">
            {payment.payment_date} · {paymentMethodLabel(payment.payment_method)}
            {payment.payment_reference ? ` · Ref. ${payment.payment_reference}` : ""}
          </p>
          {payment.notes && <p className="text-sm text-muted-foreground">{payment.notes}</p>}
          {payment.payment_proof_path && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void openProof(payment.payment_proof_path!)}
            >
              Ver comprobante
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Pago registrado el{" "}
            {new Date(payment.recorded_at).toLocaleString("es-AR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            . El registro es histórico y no se modifica.
          </p>
        </div>
      ) : settlement.status !== "ready_for_payment" ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          El pago se registra cuando la liquidación está lista para pago, es decir con la factura
          aprobada.
        </p>
      ) : !isAdmin ? (
        <p className="text-sm text-muted-foreground">
          Lista para pago. Administración va a registrar el pago.
        </p>
      ) : !open ? (
        <Button onClick={() => setOpen(true)}>Registrar pago</Button>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Fecha efectiva del pago</Label>
              <Input
                id="pay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Importe en {settlement.currency}</Label>
              <Input
                id="pay-amount"
                inputMode="decimal"
                value={amount ?? String(total)}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Debe ser exactamente {formatMoney(settlement.currency, total)} — importe final con
                ajustes y saldos aplicados. No hay pagos parciales.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Medio de pago</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Referencia</Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Número de transferencia o comprobante"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pay-proof">Comprobante (PDF, JPG o PNG — opcional)</Label>
              <Input
                id="pay-proof"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setProof(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pay-notes">Observaciones</Label>
              <Textarea
                id="pay-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => record.mutate()} disabled={record.isPending}>
              {record.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar pago
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
