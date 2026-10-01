import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Pencil, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createPromotion,
  isPromotionAvailable,
  listPromotions,
  setPromotionActive,
  updatePromotion,
  type Promotion,
  type PromotionInput,
} from "@/lib/promotions";

export const Route = createFileRoute("/_authenticated/promotions")({
  component: PromotionsPage,
  head: () => ({
    meta: [
      { title: "Promociones — ViaE Sales Hub" },
      { name: "description", content: "Promociones reutilizables para incluir en las cotizaciones." },
      { property: "og:title", content: "Promociones — ViaE Sales Hub" },
      { property: "og:description", content: "Promociones reutilizables para incluir en las cotizaciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EMPTY: PromotionInput = { title: "", description: "", is_active: true, valid_from: "", valid_to: "" };

function PromotionsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["promotions"], queryFn: listPromotions });
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PromotionInput>(EMPTY);

  const save = useMutation({
    mutationFn: () => (editing ? updatePromotion(editing.id, form) : createPromotion(form)),
    onSuccess: () => {
      toast.success(editing ? "Promoción actualizada" : "Promoción creada");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (p: Promotion) => setPromotionActive(p.id, !p.is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotions"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(p: Promotion) {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      is_active: p.is_active,
      valid_from: p.valid_from ?? "",
      valid_to: p.valid_to ?? "",
    });
    setOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Promociones</h1>
          <p className="text-sm text-muted-foreground">
            Cargalas una vez y elegilas al armar cada cotización. Son información comercial: no cambian el precio.
          </p>
        </div>
        <Button onClick={openNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nueva promoción
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <BadgePercent className="mx-auto mb-2 h-6 w-6" />
          Todavía no hay promociones.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{p.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${isPromotionAvailable(p) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {!p.is_active ? "Inactiva" : isPromotionAvailable(p) ? "Activa" : "Fuera de vigencia"}
                  </span>
                </div>
                {p.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{p.description}</p>}
                {(p.valid_from || p.valid_to) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vigencia: {p.valid_from ?? "—"} a {p.valid_to ?? "—"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={p.is_active} onCheckedChange={() => toggle.mutate(p)} aria-label="Activa" />
                  Activa
                </label>
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar promoción" : "Nueva promoción"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="10% OFF por pago en efectivo" />
            </div>
            <div className="space-y-2">
              <Label>Texto que verá el cliente</Label>
              <Textarea rows={3} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Vigente desde</Label>
                <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Vigente hasta</Label>
                <Input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              Activa
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
