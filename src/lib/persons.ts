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
