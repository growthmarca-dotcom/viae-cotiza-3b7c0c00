import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, ShieldAlert, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-account";
import { ProviderFormDialog } from "@/components/provider-form-dialog";
import { listResources } from "@/lib/resources";
import { formatMoney } from "@/lib/currency";
import {
  assignResourceToProvider,
  averageRating,
  createEvaluation,
  EMPTY_EVALUATION,
  getProvider,
  getProviderPanel,
  listEvaluations,
  providerModeLabel,
  providerStatusLabel,
  providerToInput,
  providerTypeLabel,
  unassignResourceFromProvider,
  updateProvider,
  type EvaluationInput,
  type ProviderInput,
} from "@/lib/providers";

export const Route = createFileRoute("/_authenticated/providers_/$id")({
  component: ProviderDetailPage,
  head: () => ({
    meta: [
      { title: "Ficha de proveedor — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Ficha completa del proveedor: datos fiscales, recursos asociados, reservas, servicios y evaluación interna.",
      },
      { property: "og:title", content: "Ficha de proveedor — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Recursos, servicios, incidencias y valoración interna de cada prestador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ProviderDetailPage() {
  const { id } = Route.useParams();
  const { isOperations, isLoading } = useAccount();
  const qc = useQueryClient();
  const [openEdit, setOpenEdit] = useState(false);

  const { data: provider } = useQuery({
    queryKey: ["provider", id],
    enabled: isOperations,
    queryFn: () => getProvider(id),
  });

  const { data: panel } = useQuery({
    queryKey: ["provider-panel", id],
    enabled: isOperations,
    queryFn: () => getProviderPanel(id),
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["provider-evaluations", id],
    enabled: isOperations,
    queryFn: () => listEvaluations(id),
  });

  const update = useMutation({
    mutationFn: (input: ProviderInput) => updateProvider(id, input),
    onSuccess: () => {
      toast.success("Proveedor actualizado");
      setOpenEdit(false);
      qc.invalidateQueries({ queryKey: ["provider", id] });
      qc.invalidateQueries({ queryKey: ["providers"] });
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

  if (!isOperations) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El módulo de proveedores está disponible para Administración y Operaciones.
        </p>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center text-sm text-muted-foreground">
        Proveedor no encontrado.
      </div>
    );
  }

  const rating = averageRating(evaluations);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <Link
        to="/providers"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a proveedores
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {providerTypeLabel(provider.provider_type)} ·{" "}
            {provider.is_company ? "Empresa" : "Persona independiente"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {provider.trade_name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estado: {providerStatusLabel(provider.status)} · Operación:{" "}
            {providerModeLabel(provider.operation_mode)}
            {rating != null && ` · Valoración interna: ${rating}/5`}
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpenEdit(true)}>
          <Pencil className="mr-2 h-4 w-4" /> Editar ficha
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Recursos asociados", value: String(panel?.resources.length ?? 0) },
          { label: "Servicios realizados", value: String(panel?.servicesDone ?? 0) },
          { label: "Servicios pendientes", value: String(panel?.servicesPending ?? 0) },
          { label: "Incidencias", value: String(panel?.incidents ?? 0) },
          { label: "Reservas vinculadas", value: String(panel?.bookings.length ?? 0) },
          { label: "Monto vendido", value: formatMoney("ARS", panel?.soldAmount ?? 0) },
          { label: "Monto comprado", value: formatMoney("ARS", panel?.boughtAmount ?? 0) },
          { label: "Estado general", value: providerStatusLabel(provider.status) },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </section>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Datos</TabsTrigger>
          <TabsTrigger value="resources">Recursos</TabsTrigger>
          <TabsTrigger value="bookings">Reservas</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluación</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-2">
            <Field label="Razón social" value={provider.legal_name} />
            <Field label="CUIT" value={provider.tax_id} />
            <Field label="Condición fiscal" value={provider.tax_condition} />
            <Field label="Contacto principal" value={provider.contact_name} />
            <Field label="Email" value={provider.email} />
            <Field label="WhatsApp" value={provider.whatsapp} />
            <Field label="Teléfono" value={provider.phone} />
            <Field label="Sitio web" value={provider.website} />
            <Field label="Dirección" value={provider.address} />
            <Field label="Ciudad" value={provider.city} />
            <Field label="Provincia" value={provider.state} />
            <Field label="País" value={provider.country} />
            <div className="sm:col-span-2">
              <Field label="Observaciones" value={provider.notes} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-6">
          <ProviderResources providerId={id} />
        </TabsContent>

        <TabsContent value="bookings" className="mt-6">
          <div className="space-y-3">
            {(panel?.bookings ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Todavía no hay reservas vinculadas a este proveedor.
              </p>
            )}
            {(panel?.bookings ?? []).map((b) => (
              <Link
                key={b.id}
                to="/bookings/$id"
                params={{ id: b.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary"
              >
                <div>
                  <p className="font-medium">{b.booking_number ?? "Reserva"}</p>
                  <p className="text-sm text-muted-foreground">
                    {b.destination ?? "Sin destino"}
                    {b.travel_start ? ` · ${b.travel_start}` : ""}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">{b.status}</span>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="evaluation" className="mt-6">
          <EvaluationPanel providerId={id} />
        </TabsContent>
      </Tabs>

      <ProviderFormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        initial={providerToInput(provider)}
        title="Editar proveedor"
        submitLabel="Guardar cambios"
        submitting={update.isPending}
        onSubmit={(input) => update.mutate(input)}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || "—"}</p>
    </div>
  );
}

/** Recursos asociados al proveedor: asignar y desasignar sin borrar nada. */
function ProviderResources({ providerId }: { providerId: string }) {
  const qc = useQueryClient();
  const [toAssign, setToAssign] = useState("");

  const { data: all = [] } = useQuery({
    queryKey: ["resources", "for-provider"],
    queryFn: () => listResources({ includeArchived: false }),
  });

  const mine = useMemo(() => all.filter((r) => r.provider_id === providerId), [all, providerId]);
  const available = useMemo(() => all.filter((r) => !r.provider_id), [all]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["resources"] });
    qc.invalidateQueries({ queryKey: ["provider-panel", providerId] });
  }

  const assign = useMutation({
    mutationFn: (resourceId: string) => assignResourceToProvider(resourceId, providerId),
    onSuccess: () => {
      toast.success("Recurso asignado al proveedor");
      setToAssign("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassign = useMutation({
    mutationFn: (resourceId: string) => unassignResourceFromProvider(resourceId),
    onSuccess: () => {
      toast.success("Recurso desasignado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Select value={toAssign} onValueChange={setToAssign}>
          <SelectTrigger className="min-w-[240px] flex-1">
            <SelectValue placeholder="Elegí un recurso sin proveedor…" />
          </SelectTrigger>
          <SelectContent>
            {available.length === 0 && (
              <SelectItem value="none" disabled>
                No hay recursos libres
              </SelectItem>
            )}
            {available.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!toAssign || toAssign === "none" || assign.isPending}
          onClick={() => assign.mutate(toAssign)}
        >
          {assign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Asignar recurso
        </Button>
        <Button variant="outline" asChild>
          <Link to="/resources">Crear o editar recursos</Link>
        </Button>
      </div>

      {mine.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Este proveedor todavía no tiene recursos asociados.
        </p>
      )}

      {mine.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div>
            <p className="font-medium">{r.name}</p>
            <p className="text-sm text-muted-foreground">
              {r.category} · {r.availability}
              {r.base_city ? ` · ${r.base_city}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/resources/$id" params={{ id: r.id }}>
                Ver ficha
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={unassign.isPending}
              onClick={() => unassign.mutate(r.id)}
            >
              Desasignar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

const SCORES = [1, 2, 3, 4, 5];

/** Evaluación interna del proveedor. Nunca se muestra al proveedor. */
function EvaluationPanel({ providerId }: { providerId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<EvaluationInput>(EMPTY_EVALUATION);

  const { data: rows = [] } = useQuery({
    queryKey: ["provider-evaluations", providerId],
    queryFn: () => listEvaluations(providerId),
  });

  const save = useMutation({
    mutationFn: () => createEvaluation(providerId, form),
    onSuccess: () => {
      toast.success("Evaluación registrada");
      setForm(EMPTY_EVALUATION);
      qc.invalidateQueries({ queryKey: ["provider-evaluations", providerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields: { key: keyof EvaluationInput; label: string }[] = [
    { key: "quality", label: "Calidad" },
    { key: "punctuality", label: "Puntualidad" },
    { key: "response_time", label: "Tiempo de respuesta" },
    { key: "compliance", label: "Cumplimiento" },
    { key: "internal_rating", label: "Valoración interna" },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Nueva evaluación</h2>
        <p className="text-sm text-muted-foreground">
          Información de uso interno. No se comparte con el proveedor.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              <Select
                value={String(form[f.key])}
                onValueChange={(v) => setForm((s) => ({ ...s, [f.key]: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCORES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label>Observaciones</Label>
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
          />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registrar evaluación
        </Button>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Todavía no hay evaluaciones registradas.
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-gold" />
              <strong>
                {Math.round(
                  ((r.quality + r.punctuality + r.response_time + r.compliance + r.internal_rating) /
                    5) *
                    10,
                ) / 10}
                /5
              </strong>
              <span className="text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("es-AR")}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Calidad {r.quality} · Puntualidad {r.punctuality} · Respuesta {r.response_time} ·
              Cumplimiento {r.compliance}
            </p>
            {r.notes && <p className="mt-2 text-sm">{r.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
