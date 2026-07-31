import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type PublicQuotation = {
  id: string;
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
  total_amount: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
};

const PUBLIC_FIELDS =
  "id, title, destination, travel_start, travel_end, nights, pax_count, guest_first_name, guest_last_name, accommodation_name, accommodation_address, accommodation_description, accommodation_services, cancellation_policy, price_per_night, taxes, total_amount, currency, notes, created_at, images, expires_at";

export const getPublicQuotation = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{20,64}$/i) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ quotation: PublicQuotation; imageUrls: string[] }> => {
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

    const { images, expires_at, ...quotation } = q as unknown as PublicQuotation & {
      images: string[] | null;
      expires_at: string | null;
    };

    if (expires_at && new Date(expires_at) < new Date()) {
      throw new Error("Cotización no encontrada");
    }

    let imageUrls: string[] = [];
    if (images && images.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("quotation-images")
        .createSignedUrls(images, 60 * 60 * 24 * 7);
      imageUrls = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
    }

    return { quotation, imageUrls };
  });
