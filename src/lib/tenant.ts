import { listMyQuotationOrganizations } from "@/lib/quotations";

/**
 * Organización comercial propietaria obligatoria (v1.12.1 — saneamiento multi-tenant).
 *
 * `opportunities.organization_id`, `quotations.organization_id` y
 * `bookings.organization_id` son NOT NULL en la base: toda creación debe
 * resolver la organización antes de insertar. Este helper resuelve la
 * organización del usuario actual y falla con un mensaje claro cuando no puede.
 */
export async function resolveMyOrganizationId(explicit?: string | null): Promise<string> {
  if (explicit) return explicit;
  const orgs = await listMyQuotationOrganizations();
  if (orgs.length === 1) return orgs[0].id;
  if (orgs.length === 0) {
    throw new Error(
      "Tu usuario no pertenece a ninguna organización comercial. Pedile a un administrador que te invite.",
    );
  }
  throw new Error(
    "Pertenecés a más de una organización: indicá explícitamente la organización propietaria.",
  );
}

/**
 * Variante tolerante para entidades donde `organization_id` es opcional
 * (`leads`, `clients`): si la organización no puede determinarse sin
 * ambigüedad devuelve `null` en lugar de fallar, para no romper flujos
 * existentes ni ocultar registros históricos.
 */
export async function resolveMyOrganizationIdSoft(
  explicit?: string | null,
): Promise<string | null> {
  try {
    return await resolveMyOrganizationId(explicit);
  } catch {
    return null;
  }
}
