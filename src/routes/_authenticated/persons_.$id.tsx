import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Pencil, UserSquare2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { BeneficiaryAuthorizationPanel } from "@/components/beneficiary-authorization-panel";
import { useAccount } from "@/hooks/use-account";
import { getOrganization, type Organization } from "@/lib/organizations";
import {
  addPersonRole,
  getPerson,
  getPersonRelations,
  listPersonRoles,
  PERSON_ROLE_TYPES,
  personDisplayName,
  personRoleLabel,
  personToInput,
  removePersonRole,
  updatePerson,
  type Person,
  type PersonInput,
  type PersonRelations,
  type PersonRole,
  type PersonRoleType,
} from "@/lib/persons";

export const Route = createFileRoute("/_authenticated/persons_/$id")({
  component: PersonDetailPage,
  head: () => ({
    meta: [
      { title: "Ficha de persona — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Identidad maestra: datos personales, roles por organización, relaciones y autorización como beneficiario.",
      },
      { property: "og:title", content: "Ficha de persona — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Identidad, roles, relaciones y estado de beneficiario de comisiones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
      No se pudo cargar la persona.
    </div>
  ),
  notFoundComponent: () => (
    <div className="rounded-xl border border-border p-6 text-sm">Persona no encontrada.</div>
  ),
});

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

function PersonDetailPage() {
  const { id } = useParams({ from: "/_authenticated/persons_/$id" });
  const { isAdmin } = useAccount();
  const [person, setPerson] = useState<Person | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [roles, setRoles] = useState<PersonRole[]>([]);
  const [relations, setRelations] = useState<PersonRelations>({ agents: [], clients: [] });
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<PersonInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [newRole, setNewRole] = useState<PersonRoleType | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getPerson(id);
      setPerson(p);
      if (p) {
        const [r, rel, o] = await Promise.all([
          listPersonRoles(p.id),
          getPersonRelations(p.id),
          getOrganization(p.organization_id).catch(() => null),
        ]);
        setRoles(r);
        setRelations(rel);
        setOrg(o);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la persona");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form || !person) return;
    setSaving(true);
    try {
      await updatePerson(person.id, form);
      toast.success("Persona actualizada");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la persona");
    } finally {
      setSaving(false);
    }
  }

  async function addRole() {
    if (!person || !newRole) return;
    try {
      await addPersonRole(person.id, person.organization_id, newRole);
      setNewRole("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar el rol");
    }
  }

  async function dropRole(roleId: string) {
    try {
      await removePersonRole(roleId);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo quitar el rol");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }
  if (!person) {
    return <div className="rounded-xl border border-border p-6 text-sm">Persona no encontrada.</div>;
  }

  const set = <K extends keyof PersonInput>(k: K, v: PersonInput[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="space-y-6">
      <Link to="/persons" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Personas
      </Link>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <UserSquare2 className="h-5 w-5 text-primary" /> {personDisplayName(person)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {org ? org.trade_name || org.legal_name : "Organización"}
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => {
                setForm(personToInput(person));
                setEditOpen(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Email" value={person.email} />
          <Field label="Teléfono" value={person.phone} />
          <Field
            label="Documento"
            value={[person.document_type, person.document_number].filter(Boolean).join(" ")}
          />
          <Field label="Fecha de nacimiento" value={person.birth_date} />
          <Field label="Nacionalidad" value={person.nationality} />
          <Field label="Idioma" value={person.language} />
          {person.notes && (
            <div className="sm:col-span-3">
              <Field label="Observaciones" value={person.notes} />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Roles
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.length === 0 && <p className="text-sm text-muted-foreground">Sin roles.</p>}
          {roles.map((r) => (
            <span
              key={r.id}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
            >
              {personRoleLabel(r.role_type)}
              {isAdmin && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => dropRole(r.id)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {isAdmin && (
          <div className="mt-4 flex gap-2">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as PersonRoleType)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Agregar rol" />
              </SelectTrigger>
              <SelectContent>
                {PERSON_ROLE_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addRole} disabled={!newRole}>
              Agregar
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Relaciones
        </h2>
        <div className="mt-3 space-y-2 text-sm">
          {relations.agents.length === 0 && relations.clients.length === 0 && (
            <p className="text-muted-foreground">
              Sin agentes ni clientes vinculados a esta identidad.
            </p>
          )}
          {relations.agents.map((a) => (
            <p key={a.id}>
              <span className="text-muted-foreground">Agente: </span>
              <Link
                to="/agents/$id"
                params={{ id: a.id }}
                className="text-primary hover:underline"
              >
                {[a.first_name, a.last_name].filter(Boolean).join(" ")}
              </Link>
            </p>
          ))}
          {relations.clients.map((c) => (
            <p key={c.id}>
              <span className="text-muted-foreground">Cliente: </span>
              <Link
                to="/clients/$id"
                params={{ id: c.id }}
                className="text-primary hover:underline"
              >
                {c.full_name ?? "Cliente"}
              </Link>
            </p>
          ))}
        </div>
      </section>

      {relations.agents.length > 0 ? (
        relations.agents.map((a) => (
          <BeneficiaryAuthorizationPanel
            key={a.id}
            beneficiaryType="agent"
            beneficiaryId={a.id}
            title={`Beneficiario de comisiones · ${[a.first_name, a.last_name].filter(Boolean).join(" ")}`}
          />
        ))
      ) : (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Beneficiario de comisiones
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nunca autorizado. La autorización se gestiona sobre el agente vinculado a esta persona:
            vinculá un agente para habilitar el cobro de comisiones.
          </p>
        </section>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar persona</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
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
                <Label>Tipo de documento</Label>
                <Input
                  className="mt-1"
                  value={form.document_type}
                  onChange={(e) => set("document_type", e.target.value)}
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
              <div>
                <Label>Fecha de nacimiento</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => set("birth_date", e.target.value)}
                />
              </div>
              <div>
                <Label>Nacionalidad</Label>
                <Input
                  className="mt-1"
                  value={form.nationality}
                  onChange={(e) => set("nationality", e.target.value)}
                />
              </div>
              <div>
                <Label>Idioma</Label>
                <Input
                  className="mt-1"
                  value={form.language}
                  onChange={(e) => set("language", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Observaciones</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !form?.first_name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
