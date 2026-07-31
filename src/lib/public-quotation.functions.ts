import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PUBLIC_FIELDS = [
  "id",
  "title",
  "destination",
  "travel_start",
  "travel_end",
  "nights",
  "pax_count",
  "guest_first_name",
  "guest_last_name",
  "accommodation_name",
  "accommodation_address",
  "accommodation_description",
  "accommodation_services",
  "cancellation_policy",
  "price_per_night",
  "taxes",
  "total_amount",
  "currency",
  "notes",
  "images",
  "created_at",
  "expires_at",
].join(", ");

export const getPublicQuotation = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{20,64}$/i) }).parse(data),
  )
  .handler(async ({ data }) => {
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

    const row = q as Record<string, unknown>;
    if (row.expires_at && new Date(row.expires_at as string) < new Date()) {
      throw new Error("Cotización no encontrada");
    }

    const images = (row.images as string[] | null) ?? [];
    let imageUrls: string[] = [];
    if (images.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("quotation-images")
        .createSignedUrls(images, 60 * 60 * 24 * 7);
      imageUrls = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
    }

    const { images: _images, expires_at: _expires, ...quotation } = row;
    return { quotation: quotation as Record<string, unknown>, imageUrls };
  });
