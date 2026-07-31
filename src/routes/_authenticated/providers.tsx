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
import { ProviderFormDialog } from "@/components/provider-form-dialog";
import {
  computeProviderStats,
  createProvider,
  listProviders,
  PROVIDER_STATUSES,
  PROVIDER_TYPES,
  providerModeLabel,
  providerStatusLabel,
  providerTypeLabel,
  type ProviderInput,
  type ProviderStatus,
  type ProviderType,
} from "@/lib/providers";

export const Route = createFileRoute("/_authenticated/providers")({
  component: ProvidersPage,
  head: () => ({
    meta: [
      { title: "Proveedores — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Catálogo central de proveedores: hoteles, mayoristas, rentadoras, transportistas y guías asociados a ViaE.",
      },
      { property: "og:title", content: "Proveedores — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Centralizá empresas y prestadores, sus recursos, servicios y evaluación interna.",
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

function ProvidersPage() {
  const { isOperations, isLoading } = useAccount();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [type, setType] = useState<ProviderType | "all">("all");
  const [status, setStatus] = useState<ProviderStatus | "all">("all");
  const [state, setState] = useState("all");
  const [country, setCountry] = useState("all");
  const [openNew, setOpenNew] = useState(false);

  const { data: providers = [] } = useQuery({
    queryKey: ["providers", { type, status, state, country }],
    enabled: isOperations,
    queryFn: () =>
      listProviders({
        type,
        status,
        state,
        country,
        includeArchived: status !== "all",
      }),
  });

  const create = useMutation({
    mutationFn: (input: ProviderInput) => createProvider(input),
    onSuccess: (id) => {
      toast.success("Proveedor creado");
      setOpenNew(false);
      qc.invalidateQueries({ queryKey: ["providers"] });
      navigate({ to: "/providers/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return providers;
    return providers.filter((p) =>
      [p.trade_name, p.legal_name, p.tax_id, p.email, p.city, p.state, p.contact_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }, [providers, search]);

  const stats = useMemo(() => computeProviderStats(providers), [providers]);
  const states = useMemo(
    () => Array.from(new Set(providers.map((p) => p.state).filter(Boolean))) as string[],
    [providers],
  );
  const countries = useMemo(
    () => Array.from(new Set(providers.map((p) => p.country).filter(Boolean))) as string[],
    [providers],
  );

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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Red de prestadores</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Proveedores
          </h1>
        </div>
        <Button size="lg" onClick={() => setOpenNew(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo proveedor
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Proveedores", value: stats.total },
          { label: "Activos", value: stats.active },
          { label: "Inactivos", value: stats.inactive + stats.suspended },
          { label: "Archivados", value: stats.archived },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{c.value}</p>
          </div>
        ))}
      </section>

      {stats.byType.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.byType.map((t) => (
            <span key={t.label} className="rounded-full border border-border px-3 py-1 text-xs">
              {t.label}: <strong>{t.count}</strong>
            </span>
          ))}
        </div>
      )}

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, CUIT, contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as ProviderType | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Clasificación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las clasificaciones</SelectItem>
            {PROVIDER_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as ProviderStatus | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {PROVIDER_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger>
            <SelectValue placeholder="Provincia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las provincias</SelectItem>
            {states.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger>
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los países</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No hay proveedores que coincidan con la búsqueda.
          </div>
        )}
        {filtered.map((p) => (
          <Link
            key={p.id}
            to="/providers/$id"
            params={{ id: p.id }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="truncate font-medium">{p.trade_name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${statusClasses[p.status] ?? ""}`}
                >
                  {providerStatusLabel(p.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {providerTypeLabel(p.provider_type)} · {providerModeLabel(p.operation_mode)}
                {p.city ? ` · ${p.city}` : ""}
                {p.state ? `, ${p.state}` : ""}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {p.contact_name && <p>{p.contact_name}</p>}
              {p.whatsapp && <p>{p.whatsapp}</p>}
            </div>
          </Link>
        ))}
      </section>

      <ProviderFormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="Nuevo proveedor"
        submitLabel="Crear proveedor"
        submitting={create.isPending}
        onSubmit={(input) => create.mutate(input)}
      />
    </div>
  );
}
