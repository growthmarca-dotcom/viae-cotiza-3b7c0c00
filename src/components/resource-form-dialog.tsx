import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { agentFullName, type Agent } from "@/lib/agents";
import {
  COMPANY_KINDS,
  EMPTY_RESOURCE,
  RECORD_STATUSES,
  RESOURCE_AVAILABILITIES,
  RESOURCE_CATEGORIES,
  RESOURCE_SPECIALTIES,
  RESOURCE_ZONES,
  type Company,
  type CompanyKind,
  type RecordStatus,
  type ResourceAvailability,
  type ResourceCategory,
  type ResourceInput,
} from "@/lib/resources";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ResourceInput;
  companies: Company[];
  agents: Agent[];
  title: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: ResourceInput) => void | Promise<void>;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
      {children}
    </h3>
  );
}

const NONE = "__none__";

export function ResourceFormDialog({
  open,
  onOpenChange,
  initial,
  companies,
  agents,
  title,
  submitLabel,
  submitting,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<ResourceInput>(initial ?? EMPTY_RESOURCE);

  useEffect(() => {
    if (open) setForm(initial ?? EMPTY_RESOURCE);
  }, [open, initial]);

  function set<K extends keyof ResourceInput>(key: K, value: ResourceInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleIn(key: "zones" | "specialties", value: string) {
    setForm((f) => {
      const current = f[key];
      return {
        ...f,
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>
            Un recurso es todo aquello que puede asignarse a una reserva: alojamientos, vehículos,
            guías, excursiones, seguros o agentes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select
              value={form.category}
              onValueChange={(v) => set("category", v as ResourceCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Origen</Label>
            <Select value={form.kind} onValueChange={(v) => set("kind", v as CompanyKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select
              value={form.company_id || NONE}
              onValueChange={(v) => set("company_id", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin empresa</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Agente vinculado</Label>
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
                    {agentFullName(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Descripción</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <SectionTitle>Contacto</SectionTitle>
          <div className="space-y-2">
            <Label>Referente</Label>
            <Input
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Zona principal</Label>
            <Input
              value={form.main_zone}
              onChange={(e) => set("main_zone", e.target.value)}
              placeholder="Bariloche, Patagonia..."
            />
          </div>

          <SectionTitle>Capacidad y disponibilidad</SectionTitle>
          <div className="space-y-2">
            <Label>Capacidad (pax)</Label>
            <Input
              type="number"
              min={0}
              value={form.pax_capacity}
              onChange={(e) => set("pax_capacity", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Unidades / habitaciones</Label>
            <Input
              type="number"
              min={0}
              value={form.unit_count}
              onChange={(e) => set("unit_count", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Límite operativo diario</Label>
            <Input
              type="number"
              min={0}
              value={form.operating_limit}
              onChange={(e) => set("operating_limit", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Disponibilidad</Label>
            <Select
              value={form.availability}
              onValueChange={(v) => set("availability", v as ResourceAvailability)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_AVAILABILITIES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estado del registro</Label>
            <Select
              value={form.record_status}
              onValueChange={(v) => set("record_status", v as RecordStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SectionTitle>Zonas de cobertura</SectionTitle>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            {RESOURCE_ZONES.map((z) => (
              <label key={z} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.zones.includes(z)}
                  onCheckedChange={() => toggleIn("zones", z)}
                />
                {z}
              </label>
            ))}
          </div>

          <SectionTitle>Especialidades</SectionTitle>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            {RESOURCE_SPECIALTIES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.specialties.includes(s)}
                  onCheckedChange={() => toggleIn("specialties", s)}
                />
                {s}
              </label>
            ))}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Observaciones internas</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSubmit(form)}
            disabled={submitting || form.name.trim().length === 0}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
