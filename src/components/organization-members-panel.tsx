import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Mail, UserMinus, Users } from "lucide-react";
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
import {
  ORGANIZATION_MEMBER_ROLES,
  organizationMemberRoleLabel,
  organizationMemberStatusLabel,
  type OrganizationMemberRole,
} from "@/lib/organizationMembers";
import {
  changeOrganizationMemberRole,
  invitationLink,
  invitationStatusLabel,
  inviteOrganizationMember,
  isInvitationExpired,
  listOrganizationInvitations,
  listOrganizationMembers,
  removeOrganizationMember,
  revokeOrganizationInvitation,
} from "@/lib/organizationInvitations";

/**
 * Intervención 4 — Membresías.
 * Panel de gestión del acceso a una organización: miembros activos,
 * cambio de rol interno, revocación e invitaciones por correo.
 * Toda la escritura pasa por las RPC existentes (SECURITY DEFINER).
 */
export function OrganizationMembersPanel({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationMemberRole>("agent");

  const members = useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: () => listOrganizationMembers(organizationId),
  });

  const invitations = useQuery({
    queryKey: ["organization-invitations", organizationId],
    queryFn: () => listOrganizationInvitations(organizationId),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["organization-members", organizationId] });
    qc.invalidateQueries({ queryKey: ["organization-invitations", organizationId] });
  };

  const invite = useMutation({
    mutationFn: () => inviteOrganizationMember(organizationId, email.trim(), role),
    onSuccess: () => {
      toast.success("Invitación creada");
      setEmail("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRole = useMutation({
    mutationFn: (v: { memberId: string; role: OrganizationMemberRole }) =>
      changeOrganizationMemberRole(v.memberId, v.role),
    onSuccess: () => {
      toast.success("Rol actualizado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMember = useMutation({
    mutationFn: (memberId: string) => removeOrganizationMember(memberId),
    onSuccess: () => {
      toast.success("Acceso revocado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) => revokeOrganizationInvitation(id),
    onSuccess: () => {
      toast.success("Invitación revocada");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = members.data ?? [];
  const pending = (invitations.data ?? []).filter((i) => i.status === "pending");

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">Miembros y accesos</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {rows.filter((m) => m.status === "active").length} activos
        </span>
      </div>

      {members.isLoading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Esta organización todavía no tiene miembros con acceso.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.full_name || m.email || "Usuario sin perfil"}
                  {m.is_owner && (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      Dueño
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.email ?? "—"} · {organizationMemberStatusLabel(m.status)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {canManage && m.status === "active" ? (
                  <>
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        changeRole.mutate({ memberId: m.id, role: v as OrganizationMemberRole })
                      }
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORGANIZATION_MEMBER_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {organizationMemberRoleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Revocar acceso"
                      onClick={() => revokeMember.mutate(m.id)}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {organizationMemberRoleLabel(m.role)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-4">
          <h3 className="text-sm font-semibold">Invitar a un usuario</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              type="email"
              placeholder="correo@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full sm:w-64"
            />
            <Select value={role} onValueChange={(v) => setRole(v as OrganizationMemberRole)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_MEMBER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {organizationMemberRoleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                if (!email.trim()) {
                  toast.error("Indicá un correo.");
                  return;
                }
                invite.mutate();
              }}
              disabled={invite.isPending}
            >
              {invite.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Invitar
            </Button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Invitaciones pendientes</h3>
          <div className="mt-3 space-y-2">
            {pending.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {organizationMemberRoleLabel(inv.role)} ·{" "}
                    {isInvitationExpired(inv) ? "Vencida" : invitationStatusLabel(inv.status)}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(invitationLink(inv.token));
                        toast.success("Enlace copiado");
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar enlace
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeInvite.mutate(inv.id)}
                    >
                      Revocar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
