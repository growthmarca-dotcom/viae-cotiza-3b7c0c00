import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { QuotationFormState } from "@/components/quotation-form";

type SaveArgs = {
  quotationId: string;
  userId: string;
  form: QuotationFormState;
  newFiles: File[];
  keptPaths: string[];
  previousPaths: string[];
};

export function formToRow(form: QuotationFormState, autoTotal?: string) {
  const totalAmountNum = Number(form.totalAmount) || Number(autoTotal) || 0;
  const title =
    form.accommodationName ||
    `${form.destination || "Cotización"} — ${form.firstName} ${form.lastName}`.trim();
  return {
    title,
    destination: form.destination || null,
    travel_start: form.travelStart || null,
    travel_end: form.travelEnd || null,
    nights: form.nights ? Number(form.nights) : null,
    pax_count: form.pax ? Number(form.pax) : null,
    guest_first_name: form.firstName || null,
    guest_last_name: form.lastName || null,
    guest_email: form.email || null,
    guest_whatsapp: form.whatsapp || null,
    accommodation_name: form.accommodationName || null,
    accommodation_address: form.address || null,
    accommodation_description: form.description || null,
    accommodation_services: form.services || null,
    cancellation_policy: form.cancellationPolicy || null,
    price_per_night: form.pricePerNight ? Number(form.pricePerNight) : null,
    taxes: form.taxes ? Number(form.taxes) : null,
    other_charges: form.otherCharges ? Number(form.otherCharges) : null,
    total_amount: totalAmountNum,
    currency: form.currency || "USD",
    exchange_rate: form.exchangeRate ? Number(form.exchangeRate) : null,
    notes: form.observations || null,
  };

}

export async function uploadImages(
  userId: string,
  quotationId: string,
  files: File[],
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${quotationId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("quotation-images")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function saveQuotationImages({
  quotationId,
  userId,
  newFiles,
  keptPaths,
  previousPaths,
}: Pick<SaveArgs, "quotationId" | "userId" | "newFiles" | "keptPaths" | "previousPaths">) {
  const uploaded = await uploadImages(userId, quotationId, newFiles);
  const finalImages = [...keptPaths, ...uploaded];
  const toRemove = previousPaths.filter((p) => !keptPaths.includes(p));
  if (toRemove.length > 0) {
    await supabase.storage.from("quotation-images").remove(toRemove);
  }
  return finalImages;
}

export async function signImageUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage
    .from("quotation-images")
    .createSignedUrls(paths, 60 * 60 * 24);
  if (error) return [];
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
}

export function rowToForm(row: Record<string, unknown>): QuotationFormState {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    firstName: s(row.guest_first_name),
    lastName: s(row.guest_last_name),
    email: s(row.guest_email),
    whatsapp: s(row.guest_whatsapp),
    destination: s(row.destination),
    travelStart: s(row.travel_start),
    travelEnd: s(row.travel_end),
    nights: s(row.nights),
    pax: s(row.pax_count),
    accommodationName: s(row.accommodation_name),
    address: s(row.accommodation_address),
    description: s(row.accommodation_description),
    services: s(row.accommodation_services),
    cancellationPolicy: s(row.cancellation_policy),
    pricePerNight: s(row.price_per_night),
    taxes: s(row.taxes),
    otherCharges: s(row.other_charges),
    totalAmount: s(row.total_amount),
    currency: s(row.currency) || "USD",
    exchangeRate: s(row.exchange_rate),
    observations: s(row.notes),
  };

}

/** Duplica una cotización existente (incluye las imágenes ya cargadas). */
export async function duplicateQuotation(id: string): Promise<string> {
  const { data: row, error } = await supabase.from("quotations").select("*").eq("id", id).single();
  if (error) throw error;

  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    share_token: _t,
    archived: _a,
    ...rest
  } = row as unknown as Record<string, unknown>;

  const payload = {
    ...rest,
    title: `${String(row.title ?? "Cotización")} (copia)`,
    status: "draft",
  } as unknown as TablesInsert<"quotations">;


  const { data: inserted, error: insErr } = await supabase
    .from("quotations")
    .insert(payload)

    .select("id")
    .single();
  if (insErr) throw insErr;
  return inserted.id;
}

/** Archiva o desarchiva una cotización. */
export async function setQuotationArchived(id: string, archived: boolean) {
  const { error } = await supabase.from("quotations").update({ archived }).eq("id", id);
  if (error) throw error;
}

// ------------------------------------------- contexto comercial (v1.10.7.2.2)

/**
 * Traduce el bloqueo del trigger `quotations_require_organization`
 * a un mensaje comprensible para el agente.
 */
export function quotationCreateErrorMessage(error: {
  message?: string;
  hint?: string | null;
}): string {
  const msg = error.message ?? "No se pudo generar la cotización";
  if (!msg.includes("Quotation requires a valid organization")) return msg;
  switch (error.hint) {
    case "ambiguous_organization":
      return "Pertenecés a más de una organización: elegí la organización propietaria de la cotización.";
    case "not_allowed_for_organization":
      return "No tenés permisos para crear cotizaciones en esa organización.";
    default:
      return "La cotización necesita una organización comercial propietaria válida.";
  }
}

export type OrganizationOption = { id: string; name: string };

/**
 * Organizaciones en las que el usuario puede crear cotizaciones
 * (membresía activa con rol comercial u operativo).
 */
export async function listMyQuotationOrganizations(): Promise<OrganizationOption[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, status, organizations(id, trade_name)")
    .eq("user_id", uid)
    .eq("status", "active");
  if (error) return [];
  const allowed = ["organization_owner", "organization_admin", "operations", "agent"];
  const rows = (data ?? []) as unknown as {
    organization_id: string;
    role: string;
    organizations: { id: string; trade_name: string } | null;
  }[];
  return rows
    .filter((r) => allowed.includes(r.role))
    .map((r) => ({
      id: r.organization_id,
      name: r.organizations?.trade_name ?? "Organización",
    }));
}

/**
 * Organización propietaria de una oportunidad (v1.10.8.1 — consolidación
 * Opportunity ↔ Quotation). La cotización que nace de una oportunidad hereda
 * SIEMPRE esta organización: no se toma un valor arbitrario del frontend.
 */
export async function organizationIdForOpportunity(
  opportunityId: string | null | undefined,
): Promise<string | null> {
  if (!opportunityId) return null;
  const { data, error } = await supabase
    .from("opportunities")
    .select("organization_id")
    .eq("id", opportunityId)
    .maybeSingle();
  if (error) return null;
  return data?.organization_id ?? null;
}

/**
 * Oportunidad abierta del cliente reutilizable para una nueva cotización.
 * Evita duplicar oportunidades por cada propuesta enviada.
 */
export async function findOpenOpportunityForClient(clientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("id, stage, record_status")
    .eq("client_id", clientId)
    .eq("record_status", "active")
    .not("stage", "in", "(booked,completed,lost,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}
