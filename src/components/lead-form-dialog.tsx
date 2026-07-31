import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { LEAD_SOURCES } from "@/lib/opportunities";
import {
  EMPTY_LEAD,
  LEAD_LANGUAGES,
  LEAD_SERVICES,
  LEAD_STATUSES,
  TRIP_TYPES,
  type LeadInput,
  type LeadStatus,
  type TripType,
} from "@/lib/leads";
import type { Agent } from "@/lib/agents";
import { agentFullName } from "@/lib/agents";
import { Checkbox } from "@/components/ui/checkbox";

const UNASSIGNED = "__none__";
const NO_TRIP_TYPE = "__none__";

export function LeadFormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  submitting,
  initial,
  agents,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  submitLabel: string;
  submitting?: boolean;
  initial?: LeadInput;
  agents: Agent[];
  onSubmit: (input: LeadInput) => void;
}) {
  const [form, setForm] = useState<LeadInput>(initial ?? EMPTY_LEAD);

  useEffect(() => {
    if (open) setForm(initial ?? EMPTY_LEAD);
  }, [open, initial]);

  function set<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>
            Datos de la consulta comercial. El historial de cambios se registra automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *">
            <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </Field>
          <Field label="Apellido">
            <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+54 9 11 ..." />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="País">
            <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label="Ciudad">
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Idioma">
            <Select value={form.language || "Español"} onValueChange={(v) => set("language", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Destino de interés">
            <Input value={form.destination} onChange={(e) => set("destination", e.target.value)} />
          </Field>
          <Field label="Fecha estimada de viaje">
            <Input type="date" value={form.travel_date} onChange={(e) => set("travel_date", e.target.value)} />
          </Field>
          <Field label="Tipo de viaje">
            <Select
              value={form.trip_type || NO_TRIP_TYPE}
              onValueChange={(v) => set("trip_type", v === NO_TRIP_TYPE ? "" : (v as TripType))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TRIP_TYPE}>Sin definir</SelectItem>
                {TRIP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Servicios de interés">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
                {LEAD_SERVICES.map((s) => {
                  const checked = form.services_interest.includes(s.value);
                  return (
                    <label key={s.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          set(
                            "services_interest",
                            v
                              ? [...form.services_interest, s.value]
                              : form.services_interest.filter((x) => x !== s.value),
                          )
                        }
                      />
                      {s.label}
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>
          <Field label="Cantidad de días">
            <Input
              type="number"
              min={0}
              value={form.days_count}
              onChange={(e) => set("days_count", e.target.value)}
            />
          </Field>
          <Field label="Cantidad de noches">
            <Input
              type="number"
              min={0}
              value={form.nights_count}
              onChange={(e) => set("nights_count", e.target.value)}
            />
          </Field>
          <Field label="Cantidad de pasajeros">
            <Input
              type="number"
              min={1}
              value={form.pax_count}
              onChange={(e) => set("pax_count", e.target.value)}
            />
          </Field>
          <Field label="Adultos">
            <Input
              type="number"
              min={0}
              value={form.adults_count}
              onChange={(e) => set("adults_count", e.target.value)}
            />
          </Field>
          <Field label="Niños">
            <Input
              type="number"
              min={0}
              value={form.children_count}
              onChange={(e) => set("children_count", e.target.value)}
            />
          </Field>
          <Field label="Edades de los niños (opcional)">
            <Input
              value={form.children_ages}
              onChange={(e) => set("children_ages", e.target.value)}
              placeholder="Ej: 4, 8, 12"
            />
          </Field>
          <Field label="Presupuesto estimado">
            <Input
              type="number"
              min={0}
              value={form.budget_amount}
              onChange={(e) => set("budget_amount", e.target.value)}
            />
          </Field>
          <Field label="Moneda">
            <Select value={form.budget_currency} onValueChange={(v) => set("budget_currency", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="ARS">ARS</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Origen de la consulta">
            <Select value={form.source} onValueChange={(v) => set("source", v as LeadInput["source"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={form.status} onValueChange={(v) => set("status", v as LeadStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Agente asignado">
            <Select
              value={form.assigned_agent_id || UNASSIGNED}
              onValueChange={(v) => set("assigned_agent_id", v === UNASSIGNED ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {agentFullName(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Comentarios">
              <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={submitting || !form.first_name.trim()}
            onClick={() => onSubmit(form)}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
