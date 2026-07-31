import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Modelo central de entidades comerciales (v1.9.1).
 *
 * `organizations` representa cualquier organización externa (proveedor,
 * agencia, mayorista, cliente corporativo o socio). Una misma organización
 * puede cumplir varios roles simultáneamente mediante `organization_roles`.
 *
 * Las tablas históricas (`companies`, `providers`) se conservan y quedan
 * vinculadas por `organization_id` para mantener compatibilidad.
 */

export type Organization = Tables<"organizations">;
export type OrganizationRoleRow = Tables<"organization_roles">;

export type OrganizationRole =
  | "provider"
  | "agency"
  | "wholesaler"
  | "corporate_client"
  | "partner";

export type OrganizationStatus = "active" | "inactive" | "suspended" | "archived";

export const ORGANIZATION_ROLES: { value: OrganizationRole; label: string; help: string }[] = [
  { value: "provider", label: "Proveedor", help: "Presta servicios operativos a ViaE." },
  { value: "agency", label: "Agencia asociada", help: "Comercializa productos ViaE." },
  { value: "wholesaler", label: "Mayorista", help: "Operador mayorista de servicios." },
  { value: "corporate_client", label: "Cliente corporativo", help: "Empresa que compra viajes." },
  { value: "partner", label: "Socio comercial", help: "Alianza o acuerdo comercial." },
];

export const ORGANIZATION_STATUSES: { value: OrganizationStatus; label: string }[] = [
  { value: "active", label: "Activa" },
  { value: "inactive", label: "Inactiva" },
  { value: "suspended", label: "Suspendida" },
  { value: "archived", label: "Archivada" },
];

export const TAX_ID_TYPES = ["CUIT", "CUIL", "DNI", "RUT", "RFC", "NIF/CIF", "EIN", "Otro"];

export function organizationRoleLabel(v: string | null | undefined) {
  return ORGANIZATION_ROLES.find((r) => r.value === v)?.label ?? "—";
}
export function organizationStatusLabel(v: string | null | undefined) {
  return ORGANIZATION_STATUSES.find((s) => s.value === v)?.label ?? "—";
}

export type OrganizationInput = {
  trade_name: string;
  legal_name: string;
  tax_id_type: string;
  tax_id: string;
  tax_condition: string;
  country: string;
  state: string;
  city: string;
  address: string;
  postal_code: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  logo_path: string;
  contact_name: string;
  status: OrganizationStatus;
  notes: string;
};

export const EMPTY_ORGANIZATION: OrganizationInput = {
  trade_name: "",
  legal_name: "",
  tax_id_type: "CUIT",
  tax_id: "",
  tax_condition: "",
  country: "Argentina",
  state: "",
  city: "",
  address: "",
  postal_code: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  logo_path: "",
  contact_name: "",
  status: "active",
  notes: "",
};

const text = (v: string) => (v.trim() ? v.trim() : null);

export function organizationToInput(o: Organization): OrganizationInput {
  return {
    trade_name: o.trade_name ?? "",
    legal_name: o.legal_name ?? "",
    tax_id_type: o.tax_id_type ?? "CUIT",
    tax_id: o.tax_id ?? "",
    tax_condition: o.tax_condition ?? "",
    country: o.country ?? "Argentina",
    state: o.state ?? "",
    city: o.city ?? "",
    address: o.address ?? "",
    postal_code: o.postal_code ?? "",
    phone: o.phone ?? "",
    whatsapp: o.whatsapp ?? "",
    email: o.email ?? "",
    website: o.website ?? "",
    logo_path: o.logo_path ?? "",
    contact_name: o.contact_name ?? "",
    status: (o.status ?? "active") as OrganizationStatus,
    notes: o.notes ?? "",
  };
}

function payload(input: OrganizationInput) {
  return {
    trade_name: input.trade_name.trim(),
    legal_name: text(input.legal_name),
    tax_id_type: text(input.tax_id_type),
    tax_id: text(input.tax_id),
    tax_condition: text(input.tax_condition),
    country: text(input.country),
    state: text(input.state),
    city: text(input.city),
    address: text(input.address),
    postal_code: text(input.postal_code),
    phone: text(input.phone),
    whatsapp: text(input.whatsapp),
    email: text(input.email),
    website: text(input.website),
    logo_path: text(input.logo_path),
    contact_name: text(input.contact_name),
    status: input.status,
    notes: text(input.notes),
  };
}

export function validateOrganization(input: OrganizationInput): string | null {
  if (!input.trade_name.trim()) return "El nombre comercial es obligatorio.";
  if (input.city.trim() && !input.state.trim())
    return "Seleccioná la provincia antes que la ciudad.";
  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    return "El email no tiene un formato válido.";
  return null;
}

// ------------------------------------------------------------ consultas

export type OrganizationFilters = {
  role?: OrganizationRole | "all";
  status?: OrganizationStatus | "all";
  country?: string;
  state?: string;
  search?: string;
  includeArchived?: boolean;
};

export type OrganizationWithRoles = Organization & { roles: OrganizationRole[] };

export async function listOrganizations(
  filters: OrganizationFilters = {},
): Promise<OrganizationWithRoles[]> {
  let query = supabase
    .from("organizations")
    .select("*, organization_roles(role)")
    .order("trade_name", { ascending: true });

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  else if (!filters.includeArchived) query = query.neq("status", "archived");
  if (filters.country && filters.country !== "all") query = query.eq("country", filters.country);
  if (filters.state && filters.state !== "all") query = query.eq("state", filters.state);

  const { data, error } = await query;
  if (error) throw error;

  let rows: OrganizationWithRoles[] = (data ?? []).map((row) => {
    const { organization_roles, ...org } = row as Organization & {
      organization_roles: { role: OrganizationRole }[] | null;
    };
    return { ...(org as Organization), roles: (organization_roles ?? []).map((r) => r.role) };
  });

  if (filters.role && filters.role !== "all") {
    rows = rows.filter((r) => r.roles.includes(filters.role as OrganizationRole));
  }

  const s = filters.search?.trim().toLowerCase();
  if (s) {
    rows = rows.filter((r) =>
      [r.trade_name, r.legal_name, r.tax_id, r.email, r.phone, r.whatsapp, r.city, r.state, r.contact_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }
  return rows;
}

export async function getOrganization(id: string): Promise<OrganizationWithRoles | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*, organization_roles(role)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { organization_roles, ...org } = data as Organization & {
    organization_roles: { role: OrganizationRole }[] | null;
  };
  return { ...(org as Organization), roles: (organization_roles ?? []).map((r) => r.role) };
}

/** Busca posibles duplicados por nombre, email o número fiscal. */
export async function findDuplicates(
  input: OrganizationInput,
  excludeId?: string,
): Promise<Organization[]> {
  const name = input.trade_name.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const tax = input.tax_id.trim().toLowerCase();
  if (!name && !email && !tax) return [];

  const { data, error } = await supabase.from("organizations").select("*");
  if (error) throw error;
  return ((data ?? []) as Organization[]).filter((o) => {
    if (excludeId && o.id === excludeId) return false;
    const matchName = name && (o.trade_name ?? "").toLowerCase() === name;
    const matchEmail = email && (o.email ?? "").toLowerCase() === email;
    const matchTax = tax && (o.tax_id ?? "").toLowerCase() === tax;
    return Boolean(matchName || matchEmail || matchTax);
  });
}

// ------------------------------------------------------------ mutaciones

export async function createOrganization(
  input: OrganizationInput,
  roles: OrganizationRole[] = [],
): Promise<string> {
  const invalid = validateOrganization(input);
  if (invalid) throw new Error(invalid);

  const dupes = await findDuplicates(input);
  if (dupes.length) {
    throw new Error(
      `Ya existe una organización con datos coincidentes: ${dupes.map((d) => d.trade_name).join(", ")}.`,
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");

  const { data, error } = await supabase
    .from("organizations")
    .insert({ ...payload(input), user_id: uid })
    .select("id")
    .single();
  if (error) throw error;

  const id = data.id as string;
  if (roles.length) await setOrganizationRoles(id, roles);
  return id;
}

export async function updateOrganization(id: string, input: OrganizationInput) {
  const invalid = validateOrganization(input);
  if (invalid) throw new Error(invalid);
  const dupes = await findDuplicates(input, id);
  if (dupes.length) {
    throw new Error(
      `Los datos coinciden con otra organización existente: ${dupes.map((d) => d.trade_name).join(", ")}.`,
    );
  }
  const { error } = await supabase.from("organizations").update(payload(input)).eq("id", id);
  if (error) throw error;
}

/** Las organizaciones no se eliminan: cambian de estado. */
export async function setOrganizationStatus(id: string, status: OrganizationStatus) {
  const { error } = await supabase.from("organizations").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setOrganizationRoles(id: string, roles: OrganizationRole[]) {
  const { data, error } = await supabase
    .from("organization_roles")
    .select("id, role")
    .eq("organization_id", id);
  if (error) throw error;

  const current = (data ?? []) as { id: string; role: OrganizationRole }[];
  const toAdd = roles.filter((r) => !current.some((c) => c.role === r));
  const toRemove = current.filter((c) => !roles.includes(c.role));

  if (toAdd.length) {
    const { error: e } = await supabase
      .from("organization_roles")
      .insert(toAdd.map((role) => ({ organization_id: id, role })));
    if (e) throw e;
  }
  if (toRemove.length) {
    const { error: e } = await supabase
      .from("organization_roles")
      .delete()
      .in(
        "id",
        toRemove.map((r) => r.id),
      );
    if (e) throw e;
  }
}

// ------------------------------------------------------------ vinculación

/** Crea (o reutiliza) la organización asociada a un proveedor existente. */
export async function ensureProviderOrganization(providerId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("ensure_provider_organization", {
    _provider_id: providerId,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export type OrganizationPanel = {
  providers: Tables<"providers">[];
  resources: Tables<"resources">[];
  transportServices: Tables<"transport_services">[];
  bookings: Tables<"bookings">[];
};

export async function getOrganizationPanel(organizationId: string): Promise<OrganizationPanel> {
  const [providers, resources, transportServices, bookings] = await Promise.all([
    supabase.from("providers").select("*").eq("organization_id", organizationId),
    supabase.from("resources").select("*").eq("organization_id", organizationId).limit(100),
    supabase
      .from("transport_services")
      .select("*")
      .eq("organization_id", organizationId)
      .order("service_date", { ascending: false })
      .limit(50),
    supabase
      .from("bookings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  for (const r of [providers, resources, transportServices, bookings]) {
    if (r.error) throw r.error;
  }
  return {
    providers: (providers.data ?? []) as Tables<"providers">[],
    resources: (resources.data ?? []) as Tables<"resources">[],
    transportServices: (transportServices.data ?? []) as Tables<"transport_services">[],
    bookings: (bookings.data ?? []) as Tables<"bookings">[],
  };
}

// ------------------------------------------------------------ métricas

export function computeOrganizationStats(rows: OrganizationWithRoles[]) {
  const byRole = ORGANIZATION_ROLES.map((r) => ({
    label: r.label,
    value: r.value,
    count: rows.filter((o) => o.roles.includes(r.value)).length,
  })).filter((r) => r.count > 0);

  return {
    total: rows.length,
    active: rows.filter((o) => o.status === "active").length,
    inactive: rows.filter((o) => o.status === "inactive" || o.status === "suspended").length,
    archived: rows.filter((o) => o.status === "archived").length,
    multiRole: rows.filter((o) => o.roles.length > 1).length,
    byRole,
  };
}
