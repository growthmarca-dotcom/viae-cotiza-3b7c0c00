import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Mail, RefreshCw, UserMinus, Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { sendOrganizationInvitationEmail } from "@/lib/invitation-email.functions";
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
  cancelOrganizationInvitation,
  changeOrganizationMemberRole,
  effectiveInvitationState,
  INVITATION_STATE_LABELS,
  invitationLink,
  inviteOrganizationMember,
  listOrganizationInvitations,
  listOrganizationMembers,
  removeOrganizationMember,
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
  networkName,
}: {
  organizationId: string;
  canManage: boolean;
  networkName?: string | null;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationMemberRole>("agent");

  const network = useQuery({
    queryKey: ["organization-network", organizationId],
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("network:agency_networks(name)").eq("id", organizationId).maybeSingle();
      return (data?.network as { name: string } | null)?.name ?? null;
    },
  });
  const networkLabel = networkName ?? network.data ?? null;

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

  const sendEmail = useServerFn(sendOrganizationInvitationEmail);
  const deliver = async (invitationId: string, renew: boolean) => {
    const r = await sendEmail({ data: { invitationId, renew, origin: window.location.origin } });
    if (!r.sent) throw new Error("El email fue bloqueado para esa dirección (rebotes o baja). Copiá el enlace y compartilo por otro medio.");
  };

  const invite = useMutation({
    mutationFn: async () => {
      const inv = await inviteOrganizationMember(organizationId, email.trim(), role);
      const reused = (inv.send_count ?? 0) > 0;
      try {
        await deliver(inv.id, false);
      } catch (e) {
        refresh();
        throw new Error(`La invitación se creó, pero el email no se pudo enviar: ${(e as Error).message}`);
      }
      return reused;
    },
    onSuccess: (reused) => {
      toast.success(reused ? "Ya había una invitación pendiente: la reenviamos" : "Invitación enviada por email");
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

  const resend = useMutation({
    mutationFn: (id: string) => deliver(id, true),
    onSuccess: () => {
      toast.success("Invitación reenviada (vence en 7 días)");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) => cancelOrganizationInvitation(id),
    onSuccess: () => {
      toast.success("Invitación cancelada");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = members.data ?? [];
  const allInvites = invitations.data ?? [];

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
          <h3 className="text-sm font-semibold">Invitar agencia/persona</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Le llega un email con un enlace personal que vence en 7 días. Al aceptar queda dentro de esta agencia y de su red.
          </p>
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

      {allInvites.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Invitaciones enviadas</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Red</th>
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {allInvites.map((inv) => {
                  const st = effectiveInvitationState(inv);
                  return (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">{organizationMemberRoleLabel(inv.role)}</p>
                      </td>
                      <td className="py-2 pr-3">{networkLabel ?? "—"}</td>
                      <td className="py-2 pr-3">{new Date(inv.created_at).toLocaleDateString("es-AR")}</td>
                      <td className="py-2 pr-3">{INVITATION_STATE_LABELS[st]}</td>
                      <td className="py-2">
                        {canManage && (st === "pending" || st === "expired") && inv.state === "pending" ? (
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" disabled={resend.isPending} onClick={() => resend.mutate(inv.id)}>
                              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reenviar
                            </Button>
                            {st === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(invitationLink(inv.token));
                                  toast.success("Enlace copiado");
                                }}
                              >
                                <Copy className="mr-1 h-3.5 w-3.5" /> Copiar enlace
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => revokeInvite.mutate(inv.id)}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
