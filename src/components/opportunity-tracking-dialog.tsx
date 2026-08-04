import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { NEXT_ACTIONS, updateOpportunity, type Opportunity } from "@/lib/opportunities";

/**
 * Edición del seguimiento comercial de una oportunidad (v1.10.8.2).
 * Sólo toca campos permitidos al agente asignado: próxima acción,
 * fecha de contacto, fecha estimada de cierre y notas.
 */
export function OpportunityTrackingDialog({
  opportunity,
  open,
  onOpenChange,
  onSaved,
}: {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState("");
  const [customAction, setCustomAction] = useState("");
  const [contactDate, setContactDate] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!opportunity) return;
    const known = opportunity.next_action
      ? NEXT_ACTIONS.includes(opportunity.next_action as never)
        ? opportunity.next_action
        : "Otro"
      : "";
    setAction(known);
    setCustomAction(known === "Otro" ? (opportunity.next_action ?? "") : "");
    setContactDate(opportunity.next_contact_date ?? "");
    setCloseDate(opportunity.expected_close_date ?? "");
    setNotes(opportunity.notes ?? "");
  }, [opportunity]);

  async function save() {
    if (!opportunity) return;
    setSaving(true);
    try {
      await updateOpportunity(opportunity.id, {
        next_action: action === "Otro" ? customAction || "Otro" : action || null,
        next_contact_date: contactDate || null,
        expected_close_date: closeDate || null,
        notes: notes || null,
      });
      toast.success("Seguimiento actualizado");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el seguimiento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar seguimiento</DialogTitle>
          <DialogDescription>{opportunity?.title ?? "Oportunidad"}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Próxima acción
            </Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                {NEXT_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {action === "Otro" && (
              <Input
                className="mt-2"
                placeholder="Describí la acción"
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value)}
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Fecha próximo contacto
              </Label>
              <Input
                className="mt-1"
                type="date"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Cierre estimado
              </Label>
              <Input
                className="mt-1"
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notas</Label>
            <Textarea
              className="mt-1"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto comercial, acuerdos, pedidos del cliente..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar seguimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
