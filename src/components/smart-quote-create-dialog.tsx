import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSmartQuoteFromOpportunity } from "@/lib/smartQuotes";

const CURRENCIES = ["USD", "ARS", "EUR", "BRL"];

/**
 * Alta de una Smart Quote desde una oportunidad (v1.10.9.2).
 * El contexto comercial (organización, oportunidad, cliente, agente) se hereda
 * de la oportunidad; sin organización válida no se permite crear.
 */
export function SmartQuoteCreateDialog({
  open,
  onOpenChange,
  opportunityId,
  organizationId,
  defaults,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  organizationId: string | null;
  defaults?: { title?: string; currency?: string; startDate?: string | null; endDate?: string | null };
  onCreated?: (smartQuoteId: string) => void;
}) {
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [currency, setCurrency] = useState(defaults?.currency ?? "USD");
  const [startDate, setStartDate] = useState(defaults?.startDate ?? "");
  const [endDate, setEndDate] = useState(defaults?.endDate ?? "");
  const [saving, setSaving] = useState(false);

  const blocked = !organizationId;

  async function submit() {
    if (blocked) return;
    if (!title.trim()) {
      toast.error("Indicá un nombre para la cotización inteligente.");
      return;
    }
    setSaving(true);
    try {
      const id = await createSmartQuoteFromOpportunity(opportunityId, {
        title: title.trim(),
        currency,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      toast.success("Cotización inteligente creada");
      onOpenChange(false);
      onCreated?.(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la cotización inteligente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Crear Smart Quote
          </DialogTitle>
          <DialogDescription>
            Hereda cliente, agente y organización de la oportunidad. Después cargás los ítems
            manualmente.
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            La oportunidad no tiene organización comercial propietaria. Asigná una organización
            antes de crear la cotización inteligente.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="sq-title">Nombre</Label>
              <Input
                id="sq-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Bariloche 7 noches — familia Pérez"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sq-start">Desde</Label>
                <Input
                  id="sq-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="sq-end">Hasta</Label>
                <Input
                  id="sq-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || blocked}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
