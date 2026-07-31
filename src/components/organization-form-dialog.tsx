import { useEffect, useMemo, useState } from "react";
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
import { GEO_COUNTRIES, cityNamesOf, regionsOf } from "@/lib/geo";
import { TAX_CONDITIONS } from "@/lib/providers";
import {
  EMPTY_ORGANIZATION,
  ORGANIZATION_ROLES,
  ORGANIZATION_STATUSES,
  TAX_ID_TYPES,
  type OrganizationInput,
  type OrganizationRole,
  type OrganizationStatus,
} from "@/lib/organizations";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: OrganizationInput;
  initialRoles?: OrganizationRole[];
  title: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: OrganizationInput, roles: OrganizationRole[]) => void | Promise<void>;
};

export function OrganizationFormDialog({
  open,
  onOpenChange,
  initial,
  initialRoles = [],
  title,
  submitLabel,
  submitting,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<OrganizationInput>(initial ?? EMPTY_ORGANIZATION);
  const [roles, setRoles] = useState<OrganizationRole[]>(initialRoles);

  useEffect(() => {
    if (open) {
      setForm(initial ?? EMPTY_ORGANIZATION);
      setRoles(initialRoles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set<K extends keyof OrganizationInput>(key: K, value: OrganizationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const regions = useMemo(() => regionsOf(form.country), [form.country]);
  const cities = useMemo(() => cityNamesOf(form.country, form.state), [form.country, form.state]);

  function toggleRole(role: OrganizationRole) {
    setRoles((r) => (r.includes(role) ? r.filter((x) => x !== role) : [...r, role]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>
            Una organización puede cumplir varios roles a la vez: proveedor, agencia, mayorista,
            cliente corporativo o socio comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nombre comercial *</Label>
            <Input value={form.trade_name} onChange={(e) => set("trade_name", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Razón social</Label>
            <Input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Tipo de identificación fiscal</Label>
            <Select value={form.tax_id_type || "CUIT"} onValueChange={(v) => set("tax_id_type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_ID_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Número fiscal</Label>
            <Input value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Condición fiscal</Label>
            <Select
              value={form.tax_condition || "none"}
              onValueChange={(v) => set("tax_condition", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin especificar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                {TAX_CONDITIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Roles de la organización</Label>
            <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
              {ORGANIZATION_ROLES.map((r) => (
                <label key={r.value} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={roles.includes(r.value)}
                    onCheckedChange={() => toggleRole(r.value)}
                  />
                  <span>
                    <span className="font-medium">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">{r.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>País</Label>
            <Select
              value={form.country || "Argentina"}
              onValueChange={(v) => {
                set("country", v);
                set("state", "");
                set("city", "");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEO_COUNTRIES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Provincia / Región</Label>
            {regions.length ? (
              <Select
                value={form.state || "none"}
                onValueChange={(v) => {
                  set("state", v === "none" ? "" : v);
                  set("city", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin especificar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.name} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
            )}
          </div>
          <div className="space-y-2">
            <Label>Ciudad</Label>
            {cities.length ? (
              <Select
                value={form.city || "none"}
                onValueChange={(v) => set("city", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin especificar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            )}
          </div>
          <div className="space-y-2">
            <Label>Código postal</Label>
            <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Dirección</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Contacto</Label>
            <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Sitio web</Label>
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Logo (URL)</Label>
            <Input value={form.logo_path} onChange={(e) => set("logo_path", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as OrganizationStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Notas internas</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Acuerdos, condiciones comerciales, observaciones…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={() => onSubmit(form, roles)} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
