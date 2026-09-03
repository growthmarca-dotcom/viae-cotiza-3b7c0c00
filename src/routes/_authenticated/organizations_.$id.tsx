import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-account";
import { OrganizationFormDialog } from "@/components/organization-form-dialog";
import { AgreementsPanel } from "@/components/agreements-panel";
import { BeneficiaryAuthorizationPanel } from "@/components/beneficiary-authorization-panel";
import { OrganizationMembersPanel } from "@/components/organization-members-panel";
import {
  ORGANIZATION_STATUSES,
  getOrganization,
  getOrganizationPanel,
  organizationRoleLabel,
  organizationStatusLabel,
  organizationToInput,
  setOrganizationRoles,
  setOrganizationStatus,
  updateOrganization,
  type OrganizationInput,
  type OrganizationRole,
  type OrganizationStatus,
} from "@/lib/organizations";

export const Route = createFileRoute("/_authenticated/organizations_/$id")({
  component: OrganizationDetailPage,
  head: () => ({
    meta: [
      { title: "Ficha de organización — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Ficha completa de la organización: datos fiscales, roles comerciales, recursos, servicios y reservas asociadas.",
      },
      { property: "og:title", content: "Ficha de organización — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Datos legales, roles múltiples e historial operativo de la organización.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function OrganizationDetailPage() {
  const { id } = Route.useParams();
  const { isOperations, isAdmin } = useAccount();
  const qc = useQueryClient();
  const [openEdit, setOpenEdit] = useState(false);

  const { data: org, isLoading } = useQuery({
    queryKey: ["organization", id],
    queryFn: () => getOrganization(id),
  });

  const { data: panel } = useQuery({
    queryKey: ["organization-panel", id],
    queryFn: () => getOrganizationPanel(id),
  });

  const save = useMutation({
    mutationFn: async ({
      input,
      roles,
    }: {
      input: OrganizationInput;
      roles: OrganizationRole[];
    }) => {
      await updateOrganization(id, input);
      await setOrganizationRoles(id, roles);
    },
    onSuccess: () => {
      toast.success("Organización actualizada");
      setOpenEdit(false);
      qc.invalidateQueries({ queryKey: ["organization", id] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: (status: OrganizationStatus) => setOrganizationStatus(id, status),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["organization", id] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Organización no encontrada</h1>
        <Link to="/organizations" className="mt-4 inline-block text-sm text-primary underline">
          Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        to="/organizations"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Organizaciones
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {[org.city, org.state, org.country].filter(Boolean).join(", ") || "Sin ubicación"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {org.trade_name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {org.roles.length ? (
              org.roles.map((r) => (
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

        {isOperations && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={(org.status ?? "active") as string}
              onValueChange={(v) => changeStatus.mutate(v as OrganizationStatus)}
            >
              <SelectTrigger className="w-44">
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
            <Button variant="outline" onClick={() => setOpenEdit(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </div>
        )}
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Datos legales</h2>
          <div className="mt-3">
            <Row label="Razón social" value={org.legal_name} />
            <Row
              label="Identificación fiscal"
              value={[org.tax_id_type, org.tax_id].filter(Boolean).join(" ")}
            />
            <Row label="Condición fiscal" value={org.tax_condition} />
            <Row label="Estado" value={organizationStatusLabel(org.status)} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Contacto</h2>
          <div className="mt-3">
            <Row label="Referente" value={org.contact_name} />
            <Row label="Teléfono" value={org.phone} />
            <Row label="WhatsApp" value={org.whatsapp} />
            <Row label="Email" value={org.email} />
            <Row label="Sitio web" value={org.website} />
            <Row
              label="Dirección"
              value={[org.address, org.postal_code].filter(Boolean).join(" · ")}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Fichas de proveedor", value: panel?.providers.length ?? 0 },
          { label: "Recursos asociados", value: panel?.resources.length ?? 0 },
          { label: "Servicios de transporte", value: panel?.transportServices.length ?? 0 },
          { label: "Reservas vinculadas", value: panel?.bookings.length ?? 0 },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </section>

      {panel && panel.providers.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Fichas de proveedor</h2>
          <div className="mt-3 space-y-2">
            {panel.providers.map((p) => (
              <Link
                key={p.id}
                to="/providers/$id"
                params={{ id: p.id }}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm transition hover:border-primary/40"
              >
                <span className="font-medium">{p.trade_name}</span>
                <span className="text-muted-foreground">Ver ficha</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {panel && panel.resources.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Recursos asociados</h2>
          <div className="mt-3 space-y-2">
            {panel.resources.slice(0, 20).map((r) => (
              <Link
                key={r.id}
                to="/resources/$id"
                params={{ id: r.id }}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm transition hover:border-primary/40"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">{r.category}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <OrganizationMembersPanel organizationId={id} canManage={isAdmin} />

      <AgreementsPanel organizationId={id} canManage={isAdmin} />

      <BeneficiaryAuthorizationPanel beneficiaryType="organization" beneficiaryId={id} />

      {org.notes && isOperations && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Notas internas</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{org.notes}</p>
        </section>
      )}

      {isAdmin && (
        <p className="text-xs text-muted-foreground">
          Todos los cambios de datos, estado y roles quedan registrados en la auditoría del sistema.
        </p>
      )}

      <OrganizationFormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        initial={organizationToInput(org)}
        initialRoles={org.roles}
        title="Editar organización"
        submitLabel="Guardar cambios"
        submitting={save.isPending}
        onSubmit={(input, roles) => save.mutate({ input, roles })}
      />
    </div>
  );
}
