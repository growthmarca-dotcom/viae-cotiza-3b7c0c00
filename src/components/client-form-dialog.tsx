import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLIENT_STATUSES, EMPTY_CLIENT, type ClientInput, type ClientStatus } from "@/lib/clients";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ClientInput;
  title: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: ClientInput) => void | Promise<void>;
};

export function ClientFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  submitLabel,
  submitting,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<ClientInput>(initial ?? EMPTY_CLIENT);

  useEffect(() => {
    if (open) setForm(initial ?? EMPTY_CLIENT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set<K extends keyof ClientInput>(k: K, v: ClientInput[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>
            Los datos quedan disponibles para futuras cotizaciones.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <FieldWrap label="Nombre" required>
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required maxLength={80} />
          </FieldWrap>
          <FieldWrap label="Apellido">
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} maxLength={80} />
          </FieldWrap>
          <FieldWrap label="Empresa (opcional)">
            <Input value={form.company} onChange={(e) => set("company", e.target.value)} maxLength={120} />
          </FieldWrap>
          <FieldWrap label="WhatsApp">
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+54 9 11 ..." maxLength={40} />
          </FieldWrap>
          <FieldWrap label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={255} />
          </FieldWrap>
          <FieldWrap label="Ciudad">
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={120} />
          </FieldWrap>
          <FieldWrap label="País">
            <Input value={form.country} onChange={(e) => set("country", e.target.value)} maxLength={120} />
          </FieldWrap>
          <FieldWrap label="Estado">
            <Select value={form.status} onValueChange={(v) => set("status", v as ClientStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLIENT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldWrap>
          <FieldWrap label="Observaciones" className="sm:col-span-2">
            <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
          </FieldWrap>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldWrap({
  label,
  children,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
