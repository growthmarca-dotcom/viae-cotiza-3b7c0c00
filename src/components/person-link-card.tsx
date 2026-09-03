import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, UserSquare2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-account";
import { listOrganizations, type Organization } from "@/lib/organizations";
import {
  createPerson,
  EMPTY_PERSON,
  getPerson,
  listPersons,
  personDisplayName,
  type Person,
  type PersonInput,
} from "@/lib/persons";

/**
 * Vínculo de una entidad comercial (agente, cliente) con su identidad maestra
 * en `persons`. No duplica los datos de la persona: sólo guarda `person_id`.
 * Los campos históricos de la entidad legacy se conservan intactos.
 */
export function PersonLinkCard({
  personId,
  onLink,
  suggestion,
  description,
}: {
  personId: string | null;
  onLink: (personId: string | null) => Promise<void>;
  suggestion?: Partial<Pick<PersonInput, "first_name" | "last_name" | "email" | "phone">>;
  description?: string;
}) {
  const { isAdmin } = useAccount();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "create">("select");
  const [persons, setPersons] = useState<Person[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PersonInput>(EMPTY_PERSON);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPerson(personId ? await getPerson(personId) : null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la persona vinculada");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDialog() {
    setOpen(true);
    setMode("select");
    setSelected("");
    setSearch("");
    try {
      const [p, o] = await Promise.all([listPersons(), listOrganizations()]);
      setPersons(p);
      setOrgs(o);
      setForm({
        ...EMPTY_PERSON,
        organization_id: o[0]?.id ?? "",
        first_name: suggestion?.first_name ?? "",
        last_name: suggestion?.last_name ?? "",
        email: suggestion?.email ?? "",
        phone: suggestion?.phone ?? "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las personas");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return persons.slice(0, 50);
    return persons
      .filter((p) =>
        [p.first_name, p.last_name, p.email, p.phone, p.document_number]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 50);
  }, [persons, search]);

  async function submit() {
    setSaving(true);
    try {
      const id = mode === "create" ? await createPerson(form) : selected;
      if (!id) throw new Error("Seleccioná una persona.");
      await onLink(id);
      toast.success("Identidad vinculada");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo vincular la identidad");
    } finally {
      setSaving(false);
    }
  }

  async function unlink() {
    setSaving(true);
    try {
      await onLink(null);
      toast.success("Vínculo eliminado");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo desvincular");
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof PersonInput>(k: K, v: PersonInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <UserSquare2 className="h-4 w-4" /> Identidad maestra
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {description ??
              "Vincula este registro con la persona única del sistema. Los datos históricos del registro no se modifican."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openDialog}>
              {personId ? "Cambiar" : "Vincular persona"}
            </Button>
            {personId && (
              <Button variant="ghost" size="sm" onClick={unlink} disabled={saving}>
                Desvincular
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : person ? (
          <div className="text-sm">
            <Link
              to="/persons/$id"
              params={{ id: person.id }}
              className="font-medium text-primary hover:underline"
            >
              {personDisplayName(person)}
            </Link>
            <p className="text-xs text-muted-foreground">
              {[person.email, person.phone, person.document_number].filter(Boolean).join(" · ") ||
                "Sin datos de contacto"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin identidad vinculada.</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular identidad</DialogTitle>
            <DialogDescription>
              Seleccioná una persona existente o creá una nueva. No se duplica información maestra.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "select" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("select")}
            >
              Persona existente
            </Button>
            <Button
              type="button"
              variant={mode === "create" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("create")}
            >
              Crear persona
            </Button>
          </div>

          {mode === "select" ? (
            <div className="space-y-3">
              <Input
                placeholder="Buscar por nombre, email o documento"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay personas registradas todavía.
                  </p>
                )}
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      selected === p.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <span className="font-medium">{personDisplayName(p)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[p.email, p.document_number].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Organización</Label>
                <Select
                  value={form.organization_id}
                  onValueChange={(v) => set("organization_id", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.trade_name || o.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nombre *</Label>
                <Input
                  className="mt-1"
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
                <Label>Email</Label>
                <Input
                  className="mt-1"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  className="mt-1"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div>
                <Label>Documento</Label>
                <Input
                  className="mt-1"
                  value={form.document_number}
                  onChange={(e) => set("document_number", e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={
                saving ||
                (mode === "select" ? !selected : !form.first_name.trim() || !form.organization_id)
              }
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
