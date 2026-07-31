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
  other_charges: number | null;
  total_amount: number | null;
  currency: string;
  exchange_rate: number | null;

  notes: string | null;
  created_at: string;
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
  "id, title, destination, travel_start, travel_end, nights, pax_count, guest_first_name, guest_last_name, accommodation_name, accommodation_address, accommodation_description, accommodation_services, cancellation_policy, price_per_night, taxes, other_charges, total_amount, currency, exchange_rate, notes, created_at, images, expires_at, archived, user_id";

export const getPublicQuotation = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{20,64}$/i) }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{ quotation: PublicQuotation; imageUrls: string[]; company: PublicCompany }> => {
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

      return { quotation, imageUrls, company };
    },
  );

