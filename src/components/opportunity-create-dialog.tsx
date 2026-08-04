import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { createClient, EMPTY_CLIENT, type Client } from "@/lib/clients";
import { CURRENCIES } from "@/lib/currency";
import { createOpportunity, LEAD_SOURCES, type LeadSource } from "@/lib/opportunities";
import { listMyQuotationOrganizations } from "@/lib/quotations";
import { useQuery } from "@tanstack/react-query";
import type { PipelineStage } from "@/lib/pipeline";

const NEW_CLIENT = "__new__";

type Props = {
  clients: Client[];
  stages: PipelineStage[];
  onCreated: () => void;
};

/**
 * Alta directa de oportunidad desde el pipeline (v1.12.1).
 * La organización propietaria se resuelve automáticamente desde la membresía
 * del usuario; si pertenece a más de una, debe elegirla.
 */
export function OpportunityCreateDialog({ clients, stages, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<string>(NEW_CLIENT);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState(stages[0]?.stage ?? "new");
  const [source, setSource] = useState<LeadSource>("other");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [organizationId, setOrganizationId] = useState("");

  const { data: organizations } = useQuery({
    queryKey: ["my-quotation-organizations"],
    queryFn: listMyQuotationOrganizations,
    enabled: open,
  });
  const orgs = organizations ?? [];
  const needsOrgChoice = orgs.length > 1;

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? "", "es", { sensitivity: "base" }),
      ),
    [clients],
  );

  function reset() {
    setClientId(NEW_CLIENT);
    setFirstName("");
    setLastName("");
    setWhatsapp("");
    setTitle("");
    setStage(stages[0]?.stage ?? "new");
    setSource("other");
    setValue("");
    setCurrency("USD");
    setOrganizationId("");
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("Indicá un título para la oportunidad");
      return;
    }
    if (clientId === NEW_CLIENT && !firstName.trim()) {
      toast.error("Indicá el nombre del cliente");
      return;
    }
    if (needsOrgChoice && !organizationId) {
      toast.error("Elegí la organización propietaria");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sesión no válida");

      let finalClientId = clientId;
      if (clientId === NEW_CLIENT) {
        finalClientId = await createClient(
          { ...EMPTY_CLIENT, firstName, lastName, whatsapp, status: "new" },
          uid,
        );
      }

      await createOpportunity({
        userId: uid,
        clientId: finalClientId,
        title: title.trim(),
        stage: stage as never,
        leadSource: source,
        estimatedValue: value ? Number(value) : 0,
        currency,
        organizationId: organizationId || null,
      });
      toast.success("Oportunidad creada");
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la oportunidad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Nueva oportunidad
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva oportunidad</DialogTitle>
          <DialogDescription>
            Se crea en el pipeline con la organización comercial de tu cuenta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CLIENT}>+ Crear cliente nuevo</SelectItem>
                {sortedClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.full_name, c.last_name].filter(Boolean).join(" ") || "Cliente"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {clientId === NEW_CLIENT && (
            <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Apellido</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>WhatsApp</Label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Título de la oportunidad</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Bariloche 7 noches — familia Pérez"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Etapa inicial</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.stage} value={s.stage}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Origen</Label>
              <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
                <SelectTrigger>
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Valor estimado</Label>
              <Input
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Moneda" />
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
          </div>

          {needsOrgChoice && (
            <div className="grid gap-2">
              <Label>Organización propietaria</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí la organización" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear oportunidad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
