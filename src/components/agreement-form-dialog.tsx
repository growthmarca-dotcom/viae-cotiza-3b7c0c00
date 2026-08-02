import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  AGREEMENT_CURRENCIES,
  AGREEMENT_STATUSES,
  AGREEMENT_TYPES,
  EMPTY_AGREEMENT,
  type AgreementInput,
  type AgreementStatus,
  type AgreementType,
  type CommissionType,
} from "@/lib/agreements";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AgreementInput;
  /** Fija la organización del acuerdo (ficha de organización). */
  lockOrganizationId?: string;
  title: string;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (input: AgreementInput) => void;
};

const NONE = "__none__";

export function AgreementFormDialog({
  open,
  onOpenChange,
  initial,
  lockOrganizationId,
  title,
  submitLabel,
  submitting,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<AgreementInput>(
    initial ?? { ...EMPTY_AGREEMENT, organization_id: lockOrganizationId ?? "" },
  );

  useEffect(() => {
    if (open) {
      setForm(initial ?? { ...EMPTY_AGREEMENT, organization_id: lockOrganizationId ?? "" });
    }
  }, [open, initial, lockOrganizationId]);

  const set = <K extends keyof AgreementInput>(k: K, v: AgreementInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { data: organizations = [] } = useQuery({
    queryKey: ["agreement-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, trade_name")
        .neq("status", "archived")
        .order("trade_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agreement-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const typeHelp = AGREEMENT_TYPES.find((t) => t.value === form.agreement_type)?.help;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>
            Registrá las condiciones comerciales pactadas. Podés vincular el acuerdo a una
            organización, a un agente, o a ambos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="agreement-title">Título del acuerdo</Label>
            <Input
              id="agreement-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ej.: Comisión temporada alta 2026"
            />
          </div>

          {!lockOrganizationId && (
            <div className="space-y-2">
              <Label>Organización</Label>
              <Select
                value={form.organization_id || NONE}
                onValueChange={(v) => set("organization_id", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin organización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin organización</SelectItem>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Agente comercial</Label>
            <Select
              value={form.agent_id || NONE}
              onValueChange={(v) => set("agent_id", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin agente</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {[a.first_name, a.last_name].filter(Boolean).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de acuerdo</Label>
            <Select
              value={form.agreement_type}
              onValueChange={(v) => set("agreement_type", v as AgreementType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGREEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeHelp && <p className="text-xs text-muted-foreground">{typeHelp}</p>}
          </div>

          <div className="space-y-2">
            <Label>Modalidad de comisión</Label>
            <Select
              value={form.commission_type || NONE}
              onValueChange={(v) =>
                set("commission_type", v === NONE ? "" : (v as CommissionType))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin definir</SelectItem>
                <SelectItem value="percentage">Porcentual</SelectItem>
                <SelectItem value="fixed">Importe fijo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agreement-value">Valor</Label>
            <Input
              id="agreement-value"
              type="number"
              min="0"
              step="0.01"
              value={form.commission_value}
              onChange={(e) => set("commission_value", e.target.value)}
              placeholder={form.commission_type === "percentage" ? "Ej.: 12" : "Ej.: 25000"}
            />
          </div>

          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGREEMENT_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agreement-from">Vigente desde</Label>
            <Input
              id="agreement-from"
              type="date"
              value={form.valid_from}
              onChange={(e) => set("valid_from", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agreement-until">Vigente hasta</Label>
            <Input
              id="agreement-until"
              type="date"
              value={form.valid_until}
              onChange={(e) => set("valid_until", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as AgreementStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGREEMENT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="agreement-notes">Notas internas</Label>
            <Textarea
              id="agreement-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Condiciones particulares, excepciones, contactos de referencia…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
