import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type PublicQuotation = {
  id: string;
  /** Número comercial legible; sólo referencia visible, nunca acceso. */
  quotation_number: string | null;
  title: string;
  destination: string | null;
  travel_start: string | null;
  travel_end: string | null;
  nights: number | null;
  pax_count: number | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
  accommodation_description: string | null;
  accommodation_services: string | null;
  cancellation_policy: string | null;
  price_per_night: number | null;
  taxes: number | null;
  other_charges: number | null;
  total_amount: number | null;
  currency: string;
  exchange_rate: number | null;

  notes: string | null;
  created_at: string;
  /** Estado comercial: habilita o no la respuesta pública del cliente. */
  status: string;
  client_responded_at: string | null;
  client_response_note: string | null;
};

/** Servicio publicado al cliente: nunca incluye proveedor ni datos internos. */
export type PublicQuotationItem = {
  category: string;
  title: string | null;
  description: string | null;
  service_date: string | null;
  end_date: string | null;
  time_label: string | null;
  origin: string | null;
  destination: string | null;
  quantity: number | null;
  pax_count: number | null;
  unit_amount: number | null;
  taxes: number | null;
  notes: string | null;
};

export type PublicCompany = {
  companyName: string | null;
  logoUrl: string | null;
  address: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  linkedin: string | null;
  primaryColor: string;
  accentColor: string;
  footerText: string | null;
};

const PUBLIC_FIELDS =
  "id, quotation_number, status, client_responded_at, client_response_note, title, destination, travel_start, travel_end, nights, pax_count, guest_first_name, guest_last_name, accommodation_name, accommodation_address, accommodation_description, accommodation_services, cancellation_policy, price_per_night, taxes, other_charges, total_amount, currency, exchange_rate, notes, created_at, images, expires_at, archived, user_id";

export const getPublicQuotation = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{20,64}$/i) }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      quotation: PublicQuotation;
      items: PublicQuotationItem[];
      imageUrls: string[];
      company: PublicCompany;
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: q, error } = await supabaseAdmin
        .from("quotations")
        .select(PUBLIC_FIELDS)
        .eq("share_token", data.token)
        .maybeSingle();

      if (error) {
        console.error("public quotation lookup failed", error);
        throw new Error("Cotización no encontrada");
      }
      if (!q) throw new Error("Cotización no encontrada");

      const { images, expires_at, archived, user_id, ...quotation } = q as unknown as PublicQuotation & {
        images: string[] | null;
        expires_at: string | null;
        archived: boolean;
        user_id: string;
      };

      if (archived) throw new Error("Cotización no encontrada");
      if (expires_at && new Date(expires_at) < new Date()) {
        throw new Error("Cotización no encontrada");
      }

      // Servicios de la cotización integral (sin proveedor ni costos internos).
      const { data: itemRows } = await supabaseAdmin
        .from("quotation_items")
        .select(
          "category, title, description, service_date, end_date, time_label, origin, destination, quantity, pax_count, unit_amount, taxes, notes",
        )
        .eq("quotation_id", quotation.id)
        .order("position", { ascending: true });
      const items = (itemRows ?? []) as unknown as PublicQuotationItem[];

      let imageUrls: string[] = [];
      if (images && images.length > 0) {
        const { data: signed } = await supabaseAdmin.storage
          .from("quotation-images")
          .createSignedUrls(images, 60 * 60 * 24 * 7);
        imageUrls = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
      }

      const { data: settings } = await supabaseAdmin
        .from("company_settings")
        .select(
          "company_name, logo_path, address, whatsapp, email, website, instagram, facebook, tiktok, linkedin, primary_color, accent_color, footer_text",
        )
        .eq("user_id", user_id)
        .maybeSingle();

      let logoUrl: string | null = null;
      if (settings?.logo_path) {
        const { data: signedLogo } = await supabaseAdmin.storage
          .from("company-logos")
          .createSignedUrl(settings.logo_path, 60 * 60 * 24 * 7);
        logoUrl = signedLogo?.signedUrl ?? null;
      }

      const company: PublicCompany = {
        companyName: settings?.company_name ?? null,
        logoUrl,
        address: settings?.address ?? null,
        whatsapp: settings?.whatsapp ?? null,
        email: settings?.email ?? null,
        website: settings?.website ?? null,
        instagram: settings?.instagram ?? null,
        facebook: settings?.facebook ?? null,
        tiktok: settings?.tiktok ?? null,
        linkedin: settings?.linkedin ?? null,
        primaryColor: settings?.primary_color ?? "#1F4636",
        accentColor: settings?.accent_color ?? "#C4A264",
        footerText: settings?.footer_text ?? null,
      };

      return { quotation, items, imageUrls, company };
    },
  );


/** Estados en los que el cliente puede aceptar o rechazar desde el enlace. */
export function clientCanRespond(status: string): boolean {
  return status === "sent" || status === "pending";
}

/**
 * Aceptación / rechazo público de la cotización por token.
 * No expone datos internos ni permite otras transiciones: sólo
 * `sent`/`pending` -> `accepted`/`rejected`, y una sola vez.
 */
export const respondPublicQuotation = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().regex(/^[a-f0-9]{20,64}$/i),
        action: z.enum(["accept", "reject"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ status: "accepted" | "rejected" }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: q, error } = await supabaseAdmin
      .from("quotations")
      .select("id, status, archived, expires_at, client_responded_at")
      .eq("share_token", data.token)
      .maybeSingle();

    if (error || !q) throw new Error("Cotización no encontrada");
    if (q.archived) throw new Error("Cotización no encontrada");
    if (q.expires_at && new Date(q.expires_at as string) < new Date()) {
      throw new Error("Esta cotización ya venció. Contactá a tu agente.");
    }
    if (q.client_responded_at) {
      throw new Error("Esta cotización ya fue respondida.");
    }
    if (!clientCanRespond(q.status as string)) {
      throw new Error("Esta cotización no admite respuesta en su estado actual.");
    }

    const next = data.action === "accept" ? "accepted" : "rejected";
    const { error: updErr } = await supabaseAdmin
      .from("quotations")
      .update({
        status: next,
        client_responded_at: new Date().toISOString(),
        client_response_note: data.note?.length ? data.note : null,
        client_response_channel: "public_link",
      } as never)
      .eq("id", q.id);

    if (updErr) {
      if (updErr.hint === "invalid_status_transition") {
        throw new Error("Esta cotización no admite respuesta en su estado actual.");
      }
      console.error("public quotation response failed", updErr);
      throw new Error("No se pudo registrar la respuesta. Intentá de nuevo.");
    }
    return { status: next };
  });
