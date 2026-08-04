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
