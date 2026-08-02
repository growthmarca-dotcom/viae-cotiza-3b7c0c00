import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
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
  archivePassenger,
  birthDateRecommended,
  createPassenger,
  documentTypeLabel,
  DOCUMENT_TYPES,
  emptyPassenger,
  groupComposition,
  listPassengers,
  passengerAge,
  passengerFullName,
  passengerTypeLabel,
  PASSENGER_TYPES,
  RELATIONSHIPS,
  updatePassenger,
  type BookingPassenger,
  type PassengerInput,
  type PassengerType,
} from "@/lib/passengers";

/**
 * Pasajeros de la reserva (v1.9.5 Fase 1).
 * Vive dentro del resumen de la reserva: alta, edición y listado.
 */
export function BookingPassengersPanel({ bookingId }: { bookingId: string }) {
  const [items, setItems] = useState<BookingPassenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PassengerInput | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listPassengers(bookingId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los pasajeros");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof PassengerInput>(key: K, value: PassengerInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const startCreate = () => {
    setEditingId(null);
    setForm({ ...emptyPassenger(), is_lead_passenger: items.length === 0 });
  };

  const startEdit = (p: BookingPassenger) => {
    setEditingId(p.id);
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      document_type: p.document_type,
      document_number: p.document_number,
      birth_date: p.birth_date,
      passenger_type: p.passenger_type ?? "adult",
      nationality: p.nationality,
      email: p.email,
      phone: p.phone,
      is_lead_passenger: p.is_lead_passenger,
      relationship_to_lead_passenger: p.relationship_to_lead_passenger,
      notes: p.notes,
    });
  };

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    try {
      if (editingId) {
        await updatePassenger(editingId, form);
        toast.success("Pasajero actualizado");
      } else {
        await createPassenger(bookingId, form);
        toast.success("Pasajero agregado");
      }
      setForm(null);
      setEditingId(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar el pasajero";
      toast.error(
        msg.includes("booking_passengers_lead_uniq")
          ? "Ya existe un pasajero titular en esta reserva"
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: BookingPassenger) => {
    try {
      await archivePassenger(p.id);
      toast.success("Pasajero quitado de la reserva");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo quitar el pasajero");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Users className="h-4 w-4 text-gold" /> Pasajeros
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personas que viajan en esta reserva. Datos internos: no se muestran en el enlace de
            seguimiento del cliente.
          </p>
        </div>
        {!form && (
          <Button size="sm" onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" /> Agregar pasajero
          </Button>
        )}
      </div>

      {form && (
        <div className="mt-5 grid gap-4 rounded-xl border border-border bg-secondary/30 p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pax-first">Nombre *</Label>
            <Input
              id="pax-first"
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pax-last">Apellido *</Label>
            <Input
              id="pax-last"
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
            />
          </div>
          <div>
            <Label>Tipo de documento</Label>
            <Select
              value={form.document_type ?? ""}
              onValueChange={(v) => set("document_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pax-doc">Número de documento</Label>
            <Input
              id="pax-doc"
              value={form.document_number ?? ""}
              onChange={(e) => set("document_number", e.target.value)}
            />
          </div>
          <div>
            <Label>Tipo de pasajero</Label>
            <Select
              value={form.passenger_type}
              onValueChange={(v) => set("passenger_type", v as PassengerType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PASSENGER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {PASSENGER_TYPES.find((t) => t.value === form.passenger_type)?.hint}
            </p>
          </div>
          <div>
            <Label htmlFor="pax-birth">
              Fecha de nacimiento
              {birthDateRecommended(form.passenger_type) ? " (recomendada)" : ""}
            </Label>
            <Input
              id="pax-birth"
              type="date"
              value={form.birth_date ?? ""}
              onChange={(e) => set("birth_date", e.target.value)}
            />
            {birthDateRecommended(form.passenger_type) && !form.birth_date && (
              <p className="mt-1 text-xs text-gold">
                Sin fecha de nacimiento no se podrá calcular la edad para tarifas diferenciadas.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="pax-nat">Nacionalidad</Label>
            <Input
              id="pax-nat"
              value={form.nationality ?? ""}
              onChange={(e) => set("nationality", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pax-email">Email</Label>
            <Input
              id="pax-email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pax-phone">Teléfono</Label>
            <Input
              id="pax-phone"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div>
            <Label>Relación con el titular</Label>
            <Select
              value={form.relationship_to_lead_passenger ?? ""}
              onValueChange={(v) => set("relationship_to_lead_passenger", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={form.is_lead_passenger}
                onChange={(e) => set("is_lead_passenger", e.target.checked)}
              />
              Pasajero titular
            </label>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pax-notes">Observaciones</Label>
            <Textarea
              id="pax-notes"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Guardar cambios" : "Agregar pasajero"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setForm(null);
                setEditingId(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando pasajeros...
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Todavía no hay pasajeros cargados en esta reserva.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border">
          {items.map((p) => {
            const age = passengerAge(p.birth_date);
            return (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium">
                    {passengerFullName(p)}
                    {p.is_lead_passenger && (
                      <span className="ml-2 rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                        Titular
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {documentTypeLabel(p.document_type)}
                    {p.document_number ? ` ${p.document_number}` : ""}
                    {p.nationality ? ` · ${p.nationality}` : ""}
                    {age != null ? ` · ${age} años` : ""}
                    {p.relationship_to_lead_passenger
                      ? ` · ${p.relationship_to_lead_passenger}`
                      : ""}
                  </p>
                  {(p.email || p.phone) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[p.email, p.phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
