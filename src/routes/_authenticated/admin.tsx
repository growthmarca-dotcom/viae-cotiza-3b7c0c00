import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, Pause, Play, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAccount, type AppRole } from "@/hooks/use-account";
import { AdminRecovery } from "@/components/admin-recovery";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Administración — ViaE Sales Hub" },
      { name: "description", content: "Aprueba cuentas, gestiona estados y asigna roles en ViaE Sales Hub." },
    ],
  }),
});

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "agent", label: "Agente" },
  { value: "provider", label: "Proveedor" },
];

type Status = "pending" | "approved" | "rejected" | "suspended";

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendiente",
  approved: "Activo",
  suspended: "Suspendido",
  rejected: "Rechazado",
};

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-secondary text-secondary-foreground",
  approved: "bg-primary/10 text-primary",
  suspended: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  rejected: "bg-destructive/10 text-destructive",
};

type Member = {
  id: string;
  full_name: string | null;
  agency_name: string | null;
  status: Status;
  created_at: string;
  roles: AppRole[];
};

type AuditEntry = {
  id: string;
  actor_id: string | null;
  target_user_id: string;
  action: string;
  role: AppRole | null;
  details: unknown;
  created_at: string;
};

async function fetchMembers(): Promise<Member[]> {
  const [{ data: profiles, error }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, agency_name, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (error) throw error;
  return (profiles ?? []).map((p) => ({
    ...(p as Omit<Member, "roles">),
    roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
  }));
}

async function fetchAudit(): Promise<AuditEntry[]> {
  const { data } = await supabase
    .from("permission_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as AuditEntry[];
}

type PendingChange =
  | { kind: "role"; member: Member; role: AppRole; has: boolean }
  | { kind: "status"; member: Member; status: Status };

function AdminPage() {
  const { isAdmin, isLoading: loadingAccount, account } = useAccount();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [working, setWorking] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn: fetchMembers,
    enabled: isAdmin,
  });
  const { data: audit } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: fetchAudit,
    enabled: isAdmin,
  });

  const members = data ?? [];
  const adminCount = members.filter((m) => m.roles.includes("admin")).length;
  const nameById = new Map(members.map((m) => [m.id, m.full_name ?? "Usuario"]));

  function requestRoleChange(member: Member, role: AppRole, has: boolean) {
    // Protección: nadie puede dejar el sistema sin administradores
    if (has && role === "admin" && adminCount <= 1) {
      toast.error("No se puede quitar el rol de Administrador: es el último administrador del sistema.");
      return;
    }
    if (has && role === "admin" && member.id === account?.userId) {
      toast.error("No puedes quitarte a ti mismo el rol de Administrador.");
      return;
    }
    setPending({ kind: "role", member, role, has });
  }

  function requestStatusChange(member: Member, status: Status) {
    if (member.id === account?.userId && status !== "approved") {
      toast.error("No puedes cambiar el estado de tu propia cuenta.");
      return;
    }
    setPending({ kind: "status", member, status });
  }

  async function applyChange() {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.kind === "status") {
        const { error } = await supabase
          .from("profiles")
          .update({ status: pending.status })
          .eq("id", pending.member.id);
        if (error) throw error;
        toast.success(`Cuenta marcada como ${STATUS_LABEL[pending.status]}`);
      } else {
        const { role, has, member } = pending;
        const { error } = has
          ? await supabase.from("user_roles").delete().eq("user_id", member.id).eq("role", role)
          : await supabase.from("user_roles").insert({ user_id: member.id, role });
        if (error) throw error;
        toast.success(has ? "Rol removido" : "Rol asignado");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
      queryClient.invalidateQueries({ queryKey: ["account"] });
      setPending(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aplicar el cambio");
    } finally {
      setWorking(false);
    }
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
        <AdminRecovery />
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
          Aprueba registros, activa o suspende cuentas y define el rol de cada usuario.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando cuentas...
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => {
            const isSelf = m.id === account?.userId;
            return (
              <div key={m.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold">
                      {m.full_name ?? "Sin nombre"}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {m.agency_name ?? "Sin agencia"} · Registro {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                    {m.status !== "approved" && (
                      <Button size="sm" onClick={() => requestStatusChange(m, "approved")}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        {m.status === "pending" ? "Aprobar" : "Activar"}
                      </Button>
                    )}
                    {m.status === "approved" && (
                      <Button size="sm" variant="outline" onClick={() => requestStatusChange(m, "suspended")}>
                        <Pause className="mr-2 h-4 w-4" /> Suspender
                      </Button>
                    )}
                    {m.status === "suspended" && (
                      <Button size="sm" variant="outline" onClick={() => requestStatusChange(m, "approved")}>
                        <Play className="mr-2 h-4 w-4" /> Reactivar
                      </Button>
                    )}
                    {m.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => requestStatusChange(m, "rejected")}
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
                        onClick={() => requestRoleChange(m, value, has)}
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
            );
          })}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <History className="h-4 w-4 text-gold" /> Registro de cambios de permisos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Últimos 30 movimientos de roles y estados de cuenta.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {(audit ?? []).length === 0 && (
            <li className="text-muted-foreground">Todavía no hay cambios registrados.</li>
          )}
          {(audit ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
              <span>
                <strong>{nameById.get(a.target_user_id) ?? "Usuario"}</strong>{" "}
                {describeAudit(a)}
                {a.actor_id ? (
                  <span className="text-muted-foreground"> · por {nameById.get(a.actor_id) ?? "Administrador"}</span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de permisos?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "role"
                ? `${pending.has ? "Se quitará" : "Se asignará"} el rol ${
                    ROLES.find((r) => r.value === pending.role)?.label
                  } a ${pending.member.full_name ?? "este usuario"}.`
                : pending
                  ? `La cuenta de ${pending.member.full_name ?? "este usuario"} pasará al estado ${
                      STATUS_LABEL[pending.status]
                    }.`
                  : ""}{" "}
              El cambio quedará registrado en el log de permisos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyChange} disabled={working}>
              {working ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function describeAudit(a: AuditEntry): string {
  const roleLabel = ROLES.find((r) => r.value === a.role)?.label ?? a.role ?? "";
  if (a.action === "role_granted") return `recibió el rol ${roleLabel}`;
  if (a.action === "role_revoked") return `perdió el rol ${roleLabel}`;
  if (a.action === "status_changed") {
    const d = a.details as { from?: string; to?: string } | null;
    const to = (d?.to as Status) ?? undefined;
    return `cambió de estado a ${to ? STATUS_LABEL[to] : "—"}`;
  }
  return a.action;
}
