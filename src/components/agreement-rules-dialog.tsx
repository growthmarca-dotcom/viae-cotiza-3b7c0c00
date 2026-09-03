import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, PlusCircle, ScrollText } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPTY_AGREEMENT_RULE,
  RULE_BASES,
  RULE_CALC_TYPES,
  RULE_CURRENCIES,
  RULE_SCOPES,
  RULE_STATUSES,
  RULE_STATUS_CLASSES,
  SERVICE_KINDS,
  createAgreementRule,
  listAgreementRules,
  ruleBaseLabel,
  ruleScopeLabel,
  ruleStatusLabel,
  ruleToInput,
  ruleValueLabel,
  serviceKindLabel,
  setAgreementRuleStatus,
  updateAgreementRule,
  type AgreementRule,
  type AgreementRuleInput,
  type RuleBase,
  type RuleCalcType,
  type RuleScope,
  type RuleStatus,
  type ServiceKind,
} from "@/lib/agreementRules";

const ANY = "__any__";

/**
 * Administración de reglas de un acuerdo. El frontend sólo configura datos:
 * el cálculo se resuelve en la base (resolve_agreement + compute_commission).
 */
export function AgreementRulesDialog({
  open,
  onOpenChange,
  agreementId,
  agreementTitle,
  canManage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agreementId: string | null;
  agreementTitle: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AgreementRule | null>(null);
  const [form, setForm] = useState<AgreementRuleInput>(EMPTY_AGREEMENT_RULE);
  const [showForm, setShowForm] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["agreement-rules", agreementId],
    queryFn: () => listAgreementRules(agreementId!),
    enabled: open && Boolean(agreementId),
  });

  useEffect(() => {
    if (!open) {
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_AGREEMENT_RULE);
    }
  }, [open]);

  const set = <K extends keyof AgreementRuleInput>(k: K, v: AgreementRuleInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["agreement-rules", agreementId] });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateAgreementRule(editing.id, form);
      return createAgreementRule(agreementId!, form);
    },
    onSuccess: () => {
      toast.success(editing ? "Regla actualizada" : "Regla creada");
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_AGREEMENT_RULE);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RuleStatus }) =>
      setAgreementRuleStatus(id, status),
    onSuccess: () => {
      toast.success("Estado de la regla actualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reglas del acuerdo</DialogTitle>
          <DialogDescription>
            {agreementTitle} · Las reglas configuradas acá son la fuente oficial del cálculo de
            comisiones.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando reglas…</p>
        ) : rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <ScrollText className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Este acuerdo todavía no tiene reglas configuradas.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{r.label || "Regla sin nombre"}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      ruleScopeLabel(r.scope),
                      serviceKindLabel(r.service_kind),
                      ruleBaseLabel(r.base),
                      ruleValueLabel(r),
                      `Prioridad ${r.priority}`,
                      r.valid_from || r.valid_until
                        ? `${r.valid_from ?? "—"} → ${r.valid_until ?? "sin límite"}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      RULE_STATUS_CLASSES[r.status ?? "active"]
                    }`}
                  >
                    {ruleStatusLabel(r.status)}
                  </span>
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          changeStatus.mutate({
                            id: r.id,
                            status: r.status === "active" ? "inactive" : "active",
                          })
                        }
                        disabled={changeStatus.isPending}
                      >
                        {r.status === "active" ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(r);
                          setForm(ruleToInput(r));
                          setShowForm(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canManage && !showForm && (
          <Button
            variant="outline"
            onClick={() => {
              setEditing(null);
              setForm(EMPTY_AGREEMENT_RULE);
              setShowForm(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva regla
          </Button>
        )}

        {canManage && showForm && (
          <div className="space-y-4 rounded-xl border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nombre de la regla</Label>
                <Input
                  value={form.label}
                  onChange={(e) => set("label", e.target.value)}
                  placeholder="Ej.: Comisión general 10%"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Ámbito</Label>
                <Select value={form.scope} onValueChange={(v) => set("scope", v as RuleScope)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_SCOPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de servicio</Label>
                <Select
                  value={form.service_kind || ANY}
                  onValueChange={(v) =>
                    set("service_kind", (v === ANY ? "" : v) as ServiceKind | "")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_KINDS.map((s) => (
                      <SelectItem key={s.value || ANY} value={s.value || ANY}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Base de cálculo</Label>
                <Select value={form.base} onValueChange={(v) => set("base", v as RuleBase)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_BASES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de valor</Label>
                <Select
                  value={form.calc_type}
                  onValueChange={(v) => set("calc_type", v as RuleCalcType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_CALC_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder={form.calc_type === "percentage" ? "10" : "5000"}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Importe mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_amount}
                  onChange={(e) => set("min_amount", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Importe máximo</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.max_amount}
                  onChange={(e) => set("max_amount", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Vigente desde</Label>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => set("valid_from", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Vigente hasta</Label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => set("valid_until", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.priority}
                  onChange={(e) => set("priority", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as RuleStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <Label className="text-sm">Excluye impuestos</Label>
                <Switch
                  checked={form.excludes_taxes}
                  onCheckedChange={(v) => set("excludes_taxes", v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <Label className="text-sm">Excluye extras</Label>
                <Switch
                  checked={form.excludes_extras}
                  onCheckedChange={(v) => set("excludes_extras", v)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Notas</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {editing ? "Guardar regla" : "Crear regla"}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
