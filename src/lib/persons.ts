import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * CRM 360 — Capa central de identidad (v1.10.7.1 Identity Core).
 *
 * `persons` es el maestro único de personas de cada organización (arquitectura
 * multi-organización White Label). `person_roles` describe qué papeles cumple
 * una misma persona dentro de esa organización (cliente, pasajero, agente,
 * contacto de proveedor, conductor, empleado).
 *
 * v1.10.7.2.1 — Person Link Layer: las entidades comerciales existentes ya
 * pueden apuntar a una identidad mediante `person_id` (nullable). Todavía **no**
 * hay backfill ni deduplicación: la identidad sigue viviendo en cada tabla
 * legacy y `person_id` es un vínculo opcional. `bookings`, `quotations` y
 * `smart_quotes` no se modificaron.
 */

export type Person = Tables<"persons">;
export type PersonRole = Tables<"person_roles">;

/** Tablas legacy vinculadas a `persons` mediante `person_id` (v1.10.7.2.1). */
export type PersonLinkedTable = "clients" | "leads" | "booking_passengers" | "agents";

/** Registro legacy que puede apuntar a una identidad de `persons`. */
export type PersonLinkable = { person_id: string | null };

export function isLinkedToPerson(row: PersonLinkable) {
  return row.person_id != null;
}

export type PersonRoleType =
  | "customer"
  | "passenger"
  | "agent"
  | "supplier_contact"
  | "driver"
  | "employee";

export const PERSON_ROLE_TYPES: { value: PersonRoleType; label: string; help: string }[] = [
  { value: "customer", label: "Cliente", help: "Persona que compra o solicita viajes." },
  { value: "passenger", label: "Pasajero", help: "Persona que viaja en un servicio." },
  { value: "agent", label: "Agente", help: "Vendedor de la red comercial." },
  {
    value: "supplier_contact",
    label: "Contacto de proveedor",
    help: "Referente operativo en una organización proveedora.",
  },
  { value: "driver", label: "Conductor", help: "Responsable de servicios de transporte." },
  { value: "employee", label: "Empleado", help: "Personal interno de la organización." },
];

export function personRoleLabel(v: string | null | undefined) {
  return PERSON_ROLE_TYPES.find((r) => r.value === v)?.label ?? "—";
}

/** Nombre visible de una persona, con reserva a email o teléfono. */
export function personDisplayName(p: Pick<Person, "first_name" | "last_name" | "email" | "phone">) {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || p.phone || "Sin nombre";
}

/** Vínculos legacy → identidad, con el rol de `person_roles` que corresponde. */
export const PERSON_LINKED_TABLES: {
  table: PersonLinkedTable;
  label: string;
  role: PersonRoleType;
}[] = [
  { table: "clients", label: "Clientes", role: "customer" },
  { table: "leads", label: "Leads", role: "customer" },
  { table: "booking_passengers", label: "Pasajeros de reserva", role: "passenger" },
  { table: "agents", label: "Agentes", role: "agent" },
];

/* ------------------------------------------------------------------ */
/* Persons como fuente maestra de identidad (activación de la capa)    */
/* ------------------------------------------------------------------ */


export const PERSON_DOCUMENT_TYPES = ["DNI", "Pasaporte", "CUIT", "CUIL", "CI", "Otro"] as const;

export type PersonInput = {
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  document_type: string;
  document_number: string;
  birth_date: string;
  nationality: string;
  language: string;
  notes: string;
};

export const EMPTY_PERSON: PersonInput = {
  organization_id: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  document_type: "",
  document_number: "",
  birth_date: "",
  nationality: "",
  language: "",
  notes: "",
};

export function personToInput(p: Person): PersonInput {
  return {
    organization_id: p.organization_id,
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    document_type: p.document_type ?? "",
    document_number: p.document_number ?? "",
    birth_date: p.birth_date ?? "",
    nationality: p.nationality ?? "",
    language: p.language ?? "",
    notes: p.notes ?? "",
  };
}

function personPayload(input: PersonInput) {
  const text = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    organization_id: input.organization_id,
    first_name: input.first_name.trim(),
    last_name: text(input.last_name),
    email: text(input.email)?.toLowerCase() ?? null,
    phone: text(input.phone),
    document_type: text(input.document_type),
    document_number: text(input.document_number),
    birth_date: text(input.birth_date),
    nationality: text(input.nationality),
    language: text(input.language),
    notes: text(input.notes),
  };
}

export async function listPersons(): Promise<Person[]> {
  const { data, error } = await supabase
    .from("persons")
    .select("*")
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Person[];
}

export async function getPerson(id: string): Promise<Person | null> {
  const { data, error } = await supabase.from("persons").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Person) ?? null;
}

/**
 * Busca una identidad equivalente antes de crear, para evitar duplicados
 * obvios dentro de la misma organización: mismo documento, o mismo email.
 * No se hace deduplicación por coincidencia débil de nombre.
 */
export async function findDuplicatePerson(
  input: Pick<PersonInput, "organization_id" | "email" | "document_number" | "document_type">,
  excludeId?: string,
): Promise<Person | null> {
  const email = input.email.trim().toLowerCase();
  const doc = input.document_number.trim();
  if (!email && !doc) return null;

  let q = supabase.from("persons").select("*").eq("organization_id", input.organization_id);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Person[];
  return (
    rows.find(
      (p) =>
        (doc && (p.document_number ?? "").trim() === doc) ||
        (email && (p.email ?? "").trim().toLowerCase() === email),
    ) ?? null
  );
}

export async function createPerson(input: PersonInput): Promise<string> {
  if (!input.organization_id) throw new Error("La persona debe pertenecer a una organización.");
  if (!input.first_name.trim()) throw new Error("El nombre es obligatorio.");
  const duplicate = await findDuplicatePerson(input);
  if (duplicate) {
    throw new Error(
      `Ya existe una persona con ese documento o email: ${personDisplayName(duplicate)}.`,
    );
  }
  const { data, error } = await supabase
    .from("persons")
    .insert(personPayload(input))
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updatePerson(id: string, input: PersonInput) {
  if (!input.first_name.trim()) throw new Error("El nombre es obligatorio.");
  const duplicate = await findDuplicatePerson(input, id);
  if (duplicate) {
    throw new Error(
      `Ya existe otra persona con ese documento o email: ${personDisplayName(duplicate)}.`,
    );
  }
  const { organization_id: _org, ...rest } = personPayload(input);
  const { error } = await supabase.from("persons").update(rest).eq("id", id);
  if (error) throw error;
}

export async function listPersonRoles(personId: string): Promise<PersonRole[]> {
  const { data, error } = await supabase
    .from("person_roles")
    .select("*")
    .eq("person_id", personId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PersonRole[];
}

export async function addPersonRole(
  personId: string,
  organizationId: string,
  role: PersonRoleType,
) {
  const existing = await listPersonRoles(personId);
  if (existing.some((r) => r.role_type === role && r.organization_id === organizationId)) return;
  const { error } = await supabase
    .from("person_roles")
    .insert({ person_id: personId, organization_id: organizationId, role_type: role });
  if (error) throw error;
}

export async function removePersonRole(roleId: string) {
  const { error } = await supabase.from("person_roles").delete().eq("id", roleId);
  if (error) throw error;
}

/* --------------------- Vínculos con entidades legacy --------------------- */

/** Vincula un agente con su identidad maestra. No borra los datos legacy. */
export async function linkAgentToPerson(agentId: string, personId: string | null) {
  const { error } = await supabase
    .from("agents")
    .update({ person_id: personId })
    .eq("id", agentId);
  if (error) throw error;
}

/** Vincula un cliente con su identidad maestra. No altera el flujo comercial. */
export async function linkClientToPerson(clientId: string, personId: string | null) {
  const { error } = await supabase
    .from("clients")
    .update({ person_id: personId })
    .eq("id", clientId);
  if (error) throw error;
}

export type PersonRelations = {
  agents: { id: string; first_name: string; last_name: string | null }[];
  clients: { id: string; full_name: string | null }[];
};

/** Entidades comerciales que ya apuntan a esta identidad. */
export async function getPersonRelations(personId: string): Promise<PersonRelations> {
  const [{ data: agents, error: aErr }, { data: clients, error: cErr }] = await Promise.all([
    supabase.from("agents").select("id, first_name, last_name").eq("person_id", personId),
    supabase.from("clients").select("id, full_name").eq("person_id", personId),
  ]);
  if (aErr) throw aErr;
  if (cErr) throw cErr;
  return {
    agents: (agents ?? []) as PersonRelations["agents"],
    clients: (clients ?? []) as PersonRelations["clients"],
  };
}
