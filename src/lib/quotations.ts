import { supabase } from "@/integrations/supabase/client";
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
    total_amount: totalAmountNum,
    currency: form.currency || "USD",
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
    totalAmount: s(row.total_amount),
    currency: s(row.currency) || "USD",
    observations: s(row.notes),
  };
}
