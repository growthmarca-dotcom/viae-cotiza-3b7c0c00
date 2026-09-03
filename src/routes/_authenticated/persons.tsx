import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, PlusCircle, Search, UserSquare2 } from "lucide-react";
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
import { listOrganizations, type OrganizationWithRoles } from "@/lib/organizations";
import {
  createPerson,
  EMPTY_PERSON,
  listPersons,
  personDisplayName,
  personRoleLabel,
  type Person,
  type PersonInput,
  type PersonRole,
} from "@/lib/persons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/persons")({
  component: PersonsPage,
  head: () => ({
    meta: [
      { title: "Personas — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Maestro único de personas: identidad, roles por organización y vínculos con agentes y clientes.",
      },
      { property: "og:title", content: "Personas — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Fuente maestra de identidad de personas de ViaE Sales Hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Related = { agents: Record<string, string>; clients: Record<string, string> };

function PersonsPage() {
  const { isAdmin } = useAccount();
  const [persons, setPersons] = useState<Person[]>([]);
  const [roles, setRoles] = useState<PersonRole[]>([]);
  const [orgs, setOrgs] = useState<OrganizationWithRoles[]>([]);
  const [related, setRelated] = useState<Related>({ agents: {}, clients: {} });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PersonInput>(EMPTY_PERSON);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [p, o, r, a, c] = await Promise.all([
        listPersons(),
        listOrganizations(),
        supabase.from("person_roles").select("*"),
        supabase.from("agents").select("id, first_name, last_name, person_id"),
        supabase.from("clients").select("id, full_name, person_id"),
      ]);
      setPersons(p);
      setOrgs(o);
      setRoles((r.data ?? []) as PersonRole[]);
      const agents: Record<string, string> = {};
      for (const row of a.data ?? []) {
        if (row.person_id)
          agents[row.person_id] = [row.first_name, row.last_name].filter(Boolean).join(" ");
      }
      const clients: Record<string, string> = {};
      for (const row of c.data ?? []) {
        if (row.person_id) clients[row.person_id] = row.full_name ?? "Cliente";
      }
      setRelated({ agents, clients });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las personas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const orgName = (id: string) => {
    const o = orgs.find((x) => x.id === id);
    return o ? o.trade_name || o.legal_name : "—";
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return persons;
    return persons.filter((p) =>
      [p.first_name, p.last_name, p.email, p.phone, p.document_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [persons, query]);

  const set = <K extends keyof PersonInput>(k: K, v: PersonInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function openDialog() {
    setForm({ ...EMPTY_PERSON, organization_id: orgs[0]?.id ?? "" });
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    try {
      await createPerson(form);
      toast.success("Persona creada");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la persona");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <UserSquare2 className="h-6 w-6 text-primary" /> Personas
          </h1>
          <p className="text-sm text-muted-foreground">
            Maestro único de identidad. Agentes y clientes se vinculan a esta identidad sin duplicar
            datos.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openDialog}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nueva persona
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, email o documento"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Todavía no hay personas registradas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Organización</th>
                <th className="px-4 py-3">Relacionado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const pr = roles.filter((r) => r.person_id === p.id);
                const rel = [related.agents[p.id] && "Agente", related.clients[p.id] && "Cliente"]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to="/persons/$id"
                        params={{ id: p.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {personDisplayName(p)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[p.email, p.phone].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {pr.map((r) => personRoleLabel(r.role_type)).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {orgName(p.organization_id)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{rel || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva persona</DialogTitle>
            <DialogDescription>
              Datos básicos de identidad. No se registran datos fiscales en esta etapa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Organización *</Label>
              <Select value={form.organization_id} onValueChange={(v) => set("organization_id", v)}>
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
            <div>
              <Label>Nacionalidad</Label>
              <Input
                className="mt-1"
                value={form.nationality}
                onChange={(e) => set("nationality", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={saving || !form.first_name.trim() || !form.organization_id}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
