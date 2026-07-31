import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, PlusCircle, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-account";
import { OrganizationFormDialog } from "@/components/organization-form-dialog";
import {
  computeOrganizationStats,
  createOrganization,
  listOrganizations,
  ORGANIZATION_ROLES,
  ORGANIZATION_STATUSES,
  organizationRoleLabel,
  organizationStatusLabel,
  type OrganizationInput,
  type OrganizationRole,
  type OrganizationStatus,
} from "@/lib/organizations";

export const Route = createFileRoute("/_authenticated/organizations")({
  component: OrganizationsPage,
  head: () => ({
    meta: [
      { title: "Organizaciones — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Modelo central de entidades comerciales: proveedores, agencias, mayoristas, clientes corporativos y socios en un único registro.",
      },
      { property: "og:title", content: "Organizaciones — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Registro único de organizaciones externas con roles múltiples y auditoría.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const statusClasses: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  inactive: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/10 text-destructive",
  archived: "bg-secondary text-muted-foreground",
};

function OrganizationsPage() {
  const { isOperations, isLoading } = useAccount();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<OrganizationRole | "all">("all");
  const [status, setStatus] = useState<OrganizationStatus | "all">("all");
  const [openNew, setOpenNew] = useState(false);

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations", { role, status }],
    queryFn: () => listOrganizations({ role, status, includeArchived: status !== "all" }),
  });

  const create = useMutation({
    mutationFn: ({ input, roles }: { input: OrganizationInput; roles: OrganizationRole[] }) =>
      createOrganization(input, roles),
    onSuccess: (id) => {
      toast.success("Organización creada");
      setOpenNew(false);
      qc.invalidateQueries({ queryKey: ["organizations"] });
      navigate({ to: "/organizations/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return organizations;
    return organizations.filter((o) =>
      [o.trade_name, o.legal_name, o.tax_id, o.email, o.city, o.state, o.contact_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }, [organizations, search]);

  const stats = useMemo(() => computeOrganizationStats(organizations), [organizations]);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Modelo central de entidades comerciales</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Organizaciones
          </h1>
        </div>
        {isOperations && (
          <Button size="lg" onClick={() => setOpenNew(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva organización
          </Button>
        )}
      </header>

      {!isOperations && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4" />
          <p>
            Tenés acceso de sólo lectura. La gestión de organizaciones corresponde a Administración
            y Operaciones.
          </p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Organizaciones", value: stats.total },
          { label: "Activas", value: stats.active },
          { label: "Con varios roles", value: stats.multiRole },
          { label: "Archivadas", value: stats.archived },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </section>

      {stats.byRole.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.byRole.map((r) => (
            <span key={r.value} className="rounded-full border border-border px-3 py-1 text-xs">
              {r.label}: <strong>{r.count}</strong>
            </span>
          ))}
        </div>
      )}

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, número fiscal, contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as OrganizationRole | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {ORGANIZATION_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as OrganizationStatus | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {ORGANIZATION_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              No hay organizaciones con los filtros seleccionados.
            </p>
          </div>
        ) : (
          filtered.map((o) => (
            <Link
              key={o.id}
              to="/organizations/$id"
              params={{ id: o.id }}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40"
            >
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold">{o.trade_name}</p>
                <p className="text-sm text-muted-foreground">
                  {[o.legal_name, o.tax_id, [o.city, o.state, o.country].filter(Boolean).join(", ")]
                    .filter(Boolean)
                    .join(" · ") || "Sin datos adicionales"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {o.roles.length ? (
                    o.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                      >
                        {organizationRoleLabel(r)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin roles asignados</span>
                  )}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[o.status ?? "active"]}`}
              >
                {organizationStatusLabel(o.status)}
              </span>
            </Link>
          ))
        )}
      </section>

      <OrganizationFormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="Nueva organización"
        submitLabel="Crear organización"
        submitting={create.isPending}
        onSubmit={(input, roles) => create.mutate({ input, roles })}
      />
    </div>
  );
}
