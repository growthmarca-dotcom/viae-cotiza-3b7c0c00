import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * v1.13 Fase 3.0 — Vista pública de Smart Quote.
 *
 * La propuesta al cliente se renderiza desde `smart_quotes` + `smart_quote_items`,
 * sin depender de `quotations` (legacy). El token se valida en el servidor con
 * el cliente privilegiado y sólo se devuelven campos comerciales: nunca costos,
 * márgenes, notas internas ni datos de proveedores.
 */

export type PublicSmartQuoteItem = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  unit_amount: number;
  total_amount: number;
};

export type PublicSmartQuote = {
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  nights: number | null;
  passengers: { label: string; count: number }[];
  passengers_total: number | null;
  currency: string;
  total_amount: number;
  status: string;
  created_at: string;
  share_expires_at: string | null;
};

export type PublicSmartQuoteBranding = {
  organizationName: string | null;
  logoUrl: string | null;
  address: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  primaryColor: string;
  accentColor: string;
  footerText: string | null;
};

function nightsBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 86_400_000);
}

const PASSENGER_LABELS: Record<string, string> = {
  adults: "Adultos",
  adult: "Adultos",
  children: "Menores",
  child: "Menores",
  infants: "Infantes",
  infant: "Infantes",
  seniors: "Adultos mayores",
  senior: "Adultos mayores",
  total: "Pasajeros",
  pax: "Pasajeros",
};

function normalizePassengers(meta: unknown): {
  rows: { label: string; count: number }[];
  total: number | null;
} {
  if (!meta || typeof meta !== "object") return { rows: [], total: null };
  const rows: { label: string; count: number }[] = [];
  let total: number | null = null;
  for (const [key, raw] of Object.entries(meta as Record<string, unknown>)) {
    const count = Number(raw);
    if (!Number.isFinite(count) || count <= 0) continue;
    if (key === "total" || key === "pax") {
      total = count;
      continue;
    }
    rows.push({ label: PASSENGER_LABELS[key] ?? key, count });
  }
  if (total == null && rows.length > 0) {
    total = rows.reduce((acc, r) => acc + r.count, 0);
  }
  return { rows, total };
}

export const getPublicSmartQuote = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{32,64}$/i) }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{ quote: PublicSmartQuote; items: PublicSmartQuoteItem[]; branding: PublicSmartQuoteBranding }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const notFound = new Error("Propuesta no encontrada");

      const { data: sq, error } = await supabaseAdmin
        .from("smart_quotes")
        .select(
          "id, user_id, organization_id, status, title, destination_country, destination_state, destination_city, start_date, end_date, passengers_metadata, currency, total_amount, created_at, share_expires_at",
        )
        .eq("share_token", data.token)
        .maybeSingle();

      if (error) {
        console.error("public smart quote lookup failed", error);
        throw notFound;
      }
      if (!sq) throw notFound;
      if (sq.status === "draft" || sq.status === "rejected" || sq.status === "expired") {
        throw notFound;
      }
      if (sq.share_expires_at && new Date(sq.share_expires_at) < new Date()) throw notFound;

      const { data: rawItems } = await supabaseAdmin
        .from("smart_quote_items")
        .select("id, title, description, quantity, unit_amount, total_amount")
        .eq("smart_quote_id", sq.id)
        .order("created_at", { ascending: true });

      const items: PublicSmartQuoteItem[] = (rawItems ?? []).map((i) => ({
        id: i.id as string,
        title: (i.title as string) ?? "Servicio",
        description: (i.description as string | null) ?? null,
        quantity: Number(i.quantity ?? 0),
        unit_amount: Number(i.unit_amount ?? 0),
        total_amount: Number(i.total_amount ?? 0),
      }));

      const passengers = normalizePassengers(sq.passengers_metadata);

      const destination =
        [sq.destination_city, sq.destination_state, sq.destination_country]
          .filter(Boolean)
          .join(", ") || null;

      const quote: PublicSmartQuote = {
        title: sq.title as string,
        destination,
        start_date: sq.start_date as string | null,
        end_date: sq.end_date as string | null,
        nights: nightsBetween(sq.start_date as string | null, sq.end_date as string | null),
        passengers: passengers.rows,
        passengers_total: passengers.total,
        currency: (sq.currency as string) || "USD",
        total_amount: Number(
          sq.total_amount ?? items.reduce((acc, i) => acc + i.total_amount, 0),
        ),
        status: sq.status as string,
        created_at: sq.created_at as string,
        share_expires_at: sq.share_expires_at as string | null,
      };

      // Branding: nombre comercial de la organización + estilo del usuario emisor.
      let organizationName: string | null = null;
      let orgLogoPath: string | null = null;
      let orgAddress: string | null = null;
      let orgWhatsapp: string | null = null;
      let orgEmail: string | null = null;
      let orgWebsite: string | null = null;

      if (sq.organization_id) {
        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("trade_name, logo_path, address, whatsapp, email, website")
          .eq("id", sq.organization_id)
          .maybeSingle();
        organizationName = (org?.trade_name as string | null) ?? null;
        orgLogoPath = (org?.logo_path as string | null) ?? null;
        orgAddress = (org?.address as string | null) ?? null;
        orgWhatsapp = (org?.whatsapp as string | null) ?? null;
        orgEmail = (org?.email as string | null) ?? null;
        orgWebsite = (org?.website as string | null) ?? null;
      }

      const { data: settings } = await supabaseAdmin
        .from("company_settings")
        .select(
          "company_name, logo_path, address, whatsapp, email, website, instagram, facebook, primary_color, accent_color, footer_text",
        )
        .eq("user_id", sq.user_id as string)
        .maybeSingle();

      const logoPath = orgLogoPath ?? (settings?.logo_path as string | null) ?? null;
      let logoUrl: string | null = null;
      if (logoPath) {
        const { data: signedLogo } = await supabaseAdmin.storage
          .from("company-logos")
          .createSignedUrl(logoPath, 60 * 60 * 24 * 7);
        logoUrl = signedLogo?.signedUrl ?? null;
      }

      const branding: PublicSmartQuoteBranding = {
        organizationName: organizationName ?? (settings?.company_name as string | null) ?? null,
        logoUrl,
        address: orgAddress ?? (settings?.address as string | null) ?? null,
        whatsapp: orgWhatsapp ?? (settings?.whatsapp as string | null) ?? null,
        email: orgEmail ?? (settings?.email as string | null) ?? null,
        website: orgWebsite ?? (settings?.website as string | null) ?? null,
        instagram: (settings?.instagram as string | null) ?? null,
        facebook: (settings?.facebook as string | null) ?? null,
        primaryColor: (settings?.primary_color as string | null) ?? "#1F4636",
        accentColor: (settings?.accent_color as string | null) ?? "#C4A264",
        footerText: (settings?.footer_text as string | null) ?? null,
      };

      return { quote, items, branding };
    },
  );
