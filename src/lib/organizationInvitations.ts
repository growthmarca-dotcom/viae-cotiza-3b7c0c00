/**
 * Membership Provisioning Layer (v1.10.7.1.3)
 *
 * Ciclo de vida del acceso SaaS White Label:
 *   Organization → Invitation → Organization Member → Access
 *
 * - `organization_invitations`: flujo previo al acceso (correo, rol propuesto, token).
 * - `organization_members`: usuarios con acceso activo (v1.10.7.1.1).
 *
 * Todas las operaciones pasan por RPC SECURITY DEFINER; no se escribe
 * directamente sobre `organization_members` desde el cliente.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  OrganizationMember,
  OrganizationMemberRole,
  OrganizationMemberStatus,
} from './organizationMembers';

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationMemberRole;
  status: OrganizationMemberStatus;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null
  created_at: string;
  updated_at: string;
  /** Estado de la invitación (v1.16): pending/accepted/rejected/cancelled/expired. */
  state: InvitationState;
  network_id: string | null;
  last_sent_at: string | null;
  send_count: number;
}

export type InvitationState = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

export const INVITATION_STATE_LABELS: Record<InvitationState, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  expired: 'Vencida',
};

/** Estado efectivo: una pendiente con fecha pasada se muestra como vencida. */
export function effectiveInvitationState(inv: Pick<OrganizationInvitation, 'state' | 'expires_at'>): InvitationState {
  if (inv.state === 'pending' && inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return 'expired';
  return inv.state;
}

export interface PublicInvitation {
  email: string;
  state: InvitationState;
  expires_at: string;
  role: OrganizationMemberRole;
  organization_name: string;
  network_name: string | null;
  inviter_name: string | null;
}

/** Datos visibles para quien tiene el enlace (sin exponer otras invitaciones). */
export async function getInvitationByToken(token: string): Promise<PublicInvitation | null> {
  const { data, error } = await supabase.rpc('get_invitation_by_token', { _token: token });
  if (error) throw error;
  return (data as unknown as PublicInvitation) ?? null;
}

export async function rejectOrganizationInvitation(token: string) {
  const { error } = await supabase.rpc('reject_organization_invitation', { _token: token });
  if (error) throw error;
}

export async function cancelOrganizationInvitation(invitationId: string) {
  const { error } = await supabase.rpc('cancel_organization_invitation', { _invitation_id: invitationId });
  if (error) throw error;
}

export const INVITATION_STATUS_LABELS: Record<OrganizationMemberStatus, string> = {
  pending: 'Pendiente',
  active: 'Aceptada',
  inactive: 'Vencida o revocada',
  suspended: 'Suspendida',
};

export function invitationStatusLabel(status: OrganizationMemberStatus | string): string {
  return INVITATION_STATUS_LABELS[status as OrganizationMemberStatus] ?? status;
}

export function isInvitationExpired(
  inv: Pick<OrganizationInvitation, 'status' | 'expires_at'>,
): boolean {
  if (inv.status !== 'pending' || !inv.expires_at) return false;
  return new Date(inv.expires_at).getTime() < Date.now();
}

/** Invita a un correo a una organización (admin global, owner u org admin). */
export async function inviteOrganizationMember(
  organizationId: string,
  email: string,
  role: OrganizationMemberRole,
) {
  const { data, error } = await supabase.rpc('invite_organization_member', {
    _org_id: organizationId,
    _email: email,
    _role: role,
  });
  if (error) throw error;
  return data as unknown as OrganizationInvitation;
}

/** Acepta una invitación por token y crea la pertenencia activa. */
export async function acceptOrganizationInvitation(token: string) {
  const { data, error } = await supabase.rpc('accept_organization_invitation', {
    _token: token,
  });
  if (error) throw error;
  if (!data) throw new Error('La invitación venció. Pedí que te envíen una nueva.');
  return data as unknown as OrganizationMember;
}

/** Cambia el rol interno de un miembro. No permite quitar el último owner. */
export async function changeOrganizationMemberRole(
  memberId: string,
  newRole: OrganizationMemberRole,
) {
  const { data, error } = await supabase.rpc('change_organization_member_role', {
    _member_id: memberId,
    _new_role: newRole,
  });
  if (error) throw error;
  return data as unknown as OrganizationMember;
}

/** Revoca el acceso de un miembro (queda `inactive`, sin borrar historial). */
export async function removeOrganizationMember(memberId: string) {
  const { data, error } = await supabase.rpc('remove_organization_member', {
    _member_id: memberId,
  });
  if (error) throw error;
  return data as unknown as OrganizationMember;
}

/** Lista invitaciones de una organización (RLS acota por pertenencia). */
export async function listOrganizationInvitations(organizationId: string) {
  const { data, error } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrganizationInvitation[];
}

export interface OrganizationMemberView extends OrganizationMember {
  full_name: string | null;
  email: string | null;
}

/** Lista los miembros de una organización con identidad legible (RPC segura). */
export async function listOrganizationMembers(organizationId: string) {
  const { data, error } = await supabase.rpc('list_organization_members', {
    _org_id: organizationId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as OrganizationMemberView[];
}

/** Revoca una invitación pendiente (queda `inactive`, sin borrar historial). */
export async function revokeOrganizationInvitation(invitationId: string) {
  const { error } = await supabase
    .from('organization_invitations')
    .update({ status: 'inactive' })
    .eq('id', invitationId);
  if (error) throw error;
}

/** URL pública del enlace de invitación. */
export function invitationLink(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/invitacion/${token}`;
}
