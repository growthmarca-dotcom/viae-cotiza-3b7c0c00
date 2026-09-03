import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { closeOpportunityAsLost, LOST_REASONS } from "@/lib/opportunities";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  opportunityTitle?: string | null;
  onClosed?: () => void;
};

/**
 * Intervención 8 — cierre asistido de la oportunidad como perdida.
 * Nunca se ejecuta automáticamente: el rechazo del cliente sólo notifica,
 * la decisión comercial la toma el agente y exige un motivo.
 */
export function OpportunityLostDialog({
  open,
  onOpenChange,
  opportunityId,
  opportunityTitle,
  onClosed,
}: Props) {
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [saving, setSaving] = useState(false);

  const finalReason = reason === "Otro" ? otherReason.trim() : reason;

  async function confirm() {
    if (!finalReason) {
      toast.error("Indicá el motivo de pérdida.");
      return;
    }
    setSaving(true);
    try {
      const result = await closeOpportunityAsLost(opportunityId, finalReason);
      onOpenChange(false);
      toast.success(
        result.status === "closed"
          ? "Oportunidad marcada como perdida."
          : "La oportunidad ya estaba cerrada: se actualizó el motivo.",
      );
      onClosed?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cerrar la oportunidad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-display">
            <XCircle className="h-5 w-5 text-destructive" /> Marcar oportunidad como perdida
          </AlertDialogTitle>
          <AlertDialogDescription>
            {opportunityTitle
              ? `Se cerrará la oportunidad “${opportunityTitle}” sin venta.`
              : "Se cerrará la oportunidad sin venta."}{" "}
            Queda registrado el motivo, la fecha, el usuario y el cambio de etapa.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí un motivo" />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reason === "Otro" && (
            <div className="space-y-1.5">
              <Label htmlFor="lost-reason-other">Detalle del motivo</Label>
              <Input
                id="lost-reason-other"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Describí brevemente el motivo"
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={saving || !finalReason}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar pérdida
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
