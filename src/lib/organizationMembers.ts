/**
 * Organization Membership Layer (v1.10.7.1.1)
 *
 * Capa de pertenencia usuario ↔ organización, base del SaaS White Label.
 *
 * IMPORTANTE — no confundir:
 * - `organization_roles`   = clasificación de la ORGANIZACIÓN (cliente, proveedor, etc.)
 * - `organization_members` = USUARIOS con acceso a esa organización y su rol interno
 *
 * Esta fase es solo estructura + helpers de seguridad. Los módulos existentes
 * (bookings, quotations, smart_quotes, motores) siguen usando los roles globales
 * de `user_roles`; la migración es progresiva.
 */

export const ORGANIZATION_MEMBER_ROLES = [
  'organization_owner',
  'organization_admin',
  'operations',
  'agent',
  'provider',
  'driver',
  'viewer',
] as const;

export type OrganizationMemberRole = (typeof ORGANIZATION_MEMBER_ROLES)[number];

export const ORGANIZATION_MEMBER_STATUSES = [
  'active',
  'pending',
  'inactive',
  'suspended',
] as const;

export type OrganizationMemberStatus = (typeof ORGANIZATION_MEMBER_STATUSES)[number];

export const ORGANIZATION_MEMBER_ROLE_LABELS: Record<OrganizationMemberRole, string> = {
  organization_owner: 'Dueño de la organización',
  organization_admin: 'Administrador de la organización',
  operations: 'Operaciones',
  agent: 'Agente',
  provider: 'Proveedor',
  driver: 'Conductor',
  viewer: 'Solo lectura',
};

export const ORGANIZATION_MEMBER_STATUS_LABELS: Record<OrganizationMemberStatus, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
};

/** Roles con capacidad de gestionar miembros dentro de su propia organización. */
export const ORGANIZATION_MANAGER_ROLES: OrganizationMemberRole[] = [
  'organization_owner',
  'organization_admin',
];

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationMemberRole;
  status: OrganizationMemberStatus;
  is_owner: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export function organizationMemberRoleLabel(role: OrganizationMemberRole | string): string {
  return ORGANIZATION_MEMBER_ROLE_LABELS[role as OrganizationMemberRole] ?? role;
}

export function organizationMemberStatusLabel(
  status: OrganizationMemberStatus | string,
): string {
  return ORGANIZATION_MEMBER_STATUS_LABELS[status as OrganizationMemberStatus] ?? status;
}

export function canManageOrganizationMembers(
  member: Pick<OrganizationMember, 'role' | 'status'> | null | undefined,
): boolean {
  if (!member || member.status !== 'active') return false;
  return ORGANIZATION_MANAGER_ROLES.includes(member.role);
}
