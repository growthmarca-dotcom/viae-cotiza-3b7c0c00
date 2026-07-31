import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAccount, type AppRole } from "@/hooks/use-account";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Administración — ViaE Sales Hub" },
      { name: "description", content: "Aprueba cuentas y asigna roles en ViaE Sales Hub." },
    ],
  }),
});

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "agent", label: "Agente" },
  { value: "provider", label: "Proveedor" },
];

type Member = {
  id: string;
  full_name: string | null;
  agency_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  roles: AppRole[];
};

async function fetchMembers(): Promise<Member[]> {
  const [{ data: profiles, error }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, agency_name, status, created_at").order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (error) throw error;
  return (profiles ?? []).map((p) => ({
    ...(p as Omit<Member, "roles">),
    roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
  }));
}

function AdminPage() {
  const { isAdmin, isLoading: loadingAccount } = useAccount();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn: fetchMembers,
    enabled: isAdmin,
  });

  async function setStatus(id: string, status: Member["status"]) {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Cuenta aprobada" : "Cuenta actualizada");
    queryClient.invalidateQueries({ queryKey: ["admin-members"] });
  }

  async function toggleRole(userId: string, role: AppRole, has: boolean) {
    const { error } = has
      ? await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["admin-members"] });
  }

  if (loadingAccount) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Solo los administradores pueden gestionar cuentas y roles.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Administración
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Cuentas y roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprueba nuevos registros y define el rol de cada usuario.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando cuentas...
        </div>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((m) => (
            <div key={m.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold">{m.full_name ?? "Sin nombre"}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.agency_name ?? "Sin agencia"} · Registro {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      m.status === "approved"
                        ? "bg-primary/10 text-primary"
                        : m.status === "rejected"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {m.status === "approved" ? "Aprobada" : m.status === "rejected" ? "Rechazada" : "Pendiente"}
                  </span>
                  {m.status !== "approved" && (
                    <Button size="sm" onClick={() => setStatus(m.id, "approved")}>
                      <UserCheck className="mr-2 h-4 w-4" /> Aprobar
                    </Button>
                  )}
                  {m.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setStatus(m.id, "rejected")}
                    >
                      <UserX className="mr-2 h-4 w-4" /> Rechazar
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                {ROLES.map(({ value, label }) => {
                  const has = m.roles.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleRole(m.id, value, has)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        has
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
