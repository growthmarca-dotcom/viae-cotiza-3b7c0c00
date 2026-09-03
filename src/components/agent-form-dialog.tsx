import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AGENT_ACCESS_STATUSES,
  AGENT_LANGUAGES,
  AGENT_SPECIALTIES,
  AGENT_STATUSES,
  AGENT_WA_STATUSES,
  EMPTY_AGENT,
  type AgentAccessStatus,
  type AgentInput,
  type AgentStatus,
  type AgentWaStatus,
  type CommissionType,
} from "@/lib/agents";
import { AGENT_AVAILABILITIES, type AgentAvailability } from "@/lib/resources";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: AgentInput;
  title: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: AgentInput) => void | Promise<void>;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export function AgentFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  submitLabel,
  submitting,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<AgentInput>(initial ?? EMPTY_AGENT);

  useEffect(() => {
    if (open) setForm(initial ?? EMPTY_AGENT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set<K extends keyof AgentInput>(k: K, v: AgentInput[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function toggleIn(key: "languages" | "specialties", value: string) {
    setForm((p) => {
      const list = p[key];
      return {
        ...p,
        [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value],
      };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>
            Un agente puede existir aunque todavía no tenga acceso al sistema.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <SectionTitle>Ficha del agente</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                className="mt-1"
                required
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </div>
            <div>
              <Label>Apellido</Label>
              <Input
                className="mt-1"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </div>
            <div>
              <Label>Empresa</Label>
              <Input
                className="mt-1"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                className="mt-1"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                className="mt-1"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input
                className="mt-1"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div>
              <Label>Provincia / Estado</Label>
              <Input
                className="mt-1"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
              />
            </div>
            <div>
              <Label>País</Label>
              <Input
                className="mt-1"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as AgentStatus)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <SectionTitle>Idiomas</SectionTitle>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {AGENT_LANGUAGES.map((l) => (
                  <label key={l} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.languages.includes(l)}
                      onCheckedChange={() => toggleIn("languages", l)}
                    />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <SectionTitle>Especialidades</SectionTitle>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {AGENT_SPECIALTIES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.specialties.includes(s)}
                      onCheckedChange={() => toggleIn("specialties", s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>Observaciones</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            La configuración de comisiones no se define en el agente: proviene exclusivamente de
            los acuerdos comerciales y sus reglas (Acuerdos comerciales → Reglas). La autorización
            para cobrar comisiones se gestiona en la ficha del agente.
          </div>

          <SectionTitle>Acceso al sistema</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Estado de acceso</Label>
              <Select
                value={form.access_status}
                onValueChange={(v) => set("access_status", v as AgentAccessStatus)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_ACCESS_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Email de invitación</Label>
              <Input
                className="mt-1"
                type="email"
                value={form.invited_email}
                onChange={(e) => set("invited_email", e.target.value)}
                placeholder="Se usará al habilitar el acceso"
              />
            </div>
          </div>

          <SectionTitle>WhatsApp (estructura preparada, sin integración)</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Número asignado</Label>
              <Input
                className="mt-1"
                value={form.wa_number}
                onChange={(e) => set("wa_number", e.target.value)}
              />
            </div>
            <div>
              <Label>Extensión</Label>
              <Input
                className="mt-1"
                value={form.wa_extension}
                onChange={(e) => set("wa_extension", e.target.value)}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={form.wa_status}
                onValueChange={(v) => set("wa_status", v as AgentWaStatus)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_WA_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SectionTitle>Motor de asignación (sólo registro)</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Disponibilidad operativa</Label>
              <Select
                value={form.availability}
                onValueChange={(v) => set("availability", v as AgentAvailability)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_AVAILABILITIES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Zona principal</Label>
              <Input
                className="mt-1"
                value={form.main_zone}
                onChange={(e) => set("main_zone", e.target.value)}
              />
            </div>
            <div>
              <Label>Prioridad</Label>
              <Input
                className="mt-1"
                type="number"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              />
            </div>
            <div>
              <Label>Capacidad máx. de clientes activos</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={form.max_active_clients}
                onChange={(e) => set("max_active_clients", e.target.value)}
              />
            </div>
            <div>
              <Label>Capacidad máx. de oportunidades</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={form.max_open_opportunities}
                onChange={(e) => set("max_open_opportunities", e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label className="font-normal">Recibe leads automáticamente</Label>
              <Switch
                checked={form.auto_receive_leads}
                onCheckedChange={(v) => set("auto_receive_leads", v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label className="font-normal">Disponible para asignación</Label>
              <Switch
                checked={form.available_for_assignment}
                onCheckedChange={(v) => set("available_for_assignment", v)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !form.first_name.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
