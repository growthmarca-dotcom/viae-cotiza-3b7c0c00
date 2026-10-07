import { createServerFn } from "@tanstack/react-start";
import { readRecommendationInterests, readRecommendations } from "@/lib/recommendations";
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
  payment_methods?: string[] | null;
  recommendations?: { product_id?: string; title?: string; description?: string; destination?: string }[] | null;
  promotions?: { promotion_id?: string | null; title?: string; text?: string }[] | null;
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
  /** Reproductor de YouTube/Vimeo copiado al agregar el producto; null si no hay. */
  video_embed_url: string | null;
  /** Galería del producto en el orden definido en el Catálogo (primera = portada). */
  gallery: string[];
};

/** Solo URLs de embed reconocidas (YouTube/Vimeo); cualquier otra se descarta. */
function publicVideoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

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
  "id, quotation_number, status, client_responded_at, client_response_note, title, destination, travel_start, travel_end, nights, pax_count, guest_first_name, guest_last_name, accommodation_name, accommodation_catalog_product_id, accommodation_unit_id, accommodation_address, accommodation_description, accommodation_services, cancellation_policy, payment_methods, promotions, recommendations, price_per_night, taxes, other_charges, total_amount, currency, exchange_rate, notes, created_at, images, expires_at, archived, user_id, organization_id";

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
      accommodationGallery: string[];
      accommodationMapsUrl: string | null;
      accommodationMapCoords: { lat: number; lng: number } | null;
      recommendations: { product_id: string; title: string; description: string; destination: string; from_price?: string; cover: string | null }[];
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

      const {
        images,
        expires_at,
        archived,
        user_id,
        organization_id,
        ...quotation
      } = q as unknown as PublicQuotation & {
        images: string[] | null;
        expires_at: string | null;
        archived: boolean;
        user_id: string;
        organization_id: string | null;
      };

      if (archived) throw new Error("Cotización no encontrada");
      if (expires_at && new Date(expires_at) < new Date()) {
        throw new Error("Cotización no encontrada");
      }

      // Servicios de la cotización integral (sin proveedor ni costos internos).
      // El video sale SOLO de la copia guardada en el ítem (details.catalog),
      // nunca del Catálogo vivo; del snapshot no se publica ningún otro dato.
      const { data: itemRows } = await supabaseAdmin
        .from("quotation_items")
        .select(
          "category, title, description, service_date, end_date, time_label, origin, destination, quantity, pax_count, unit_amount, taxes, notes, details",
        )
        .eq("quotation_id", quotation.id)
        .order("position", { ascending: true });
      const rows = (itemRows ?? []).map((r) => {
        const { details, ...rest } = r as unknown as PublicQuotationItem & { details: unknown };
        const cat = (details as { catalog?: { video_url?: unknown; product_id?: unknown } } | null)?.catalog;
        const raw = typeof cat?.video_url === "string" ? cat.video_url : null;
        const productId = typeof cat?.product_id === "string" ? cat.product_id : null;
        return { rest, productId, video_embed_url: raw ? publicVideoEmbed(raw) : null };
      });
      // Galería: única fuente = product_media del Catálogo, ordenada por order_index.
      // Solo se exponen las URLs de imagen (firmadas si son archivos propios).
      const accProductId = (q as { accommodation_catalog_product_id?: string | null }).accommodation_catalog_product_id ?? null;
      const recs = readRecommendations((q as { recommendations?: unknown }).recommendations);
      const productIds = [...new Set([...rows.map((r) => r.productId), accProductId, ...recs.map((r) => r.product_id)].filter(Boolean))] as string[];
      const galleryByProduct = new Map<string, string[]>();
      if (productIds.length) {
        const { data: media } = await supabaseAdmin
          .from("product_media")
          .select("product_id, url, order_index")
          .in("product_id", productIds)
          .eq("type", "image")
          .order("order_index", { ascending: true });
        const prefix = "storage://catalog-images/";
        const stored = (media ?? []).filter((m) => m.url.startsWith(prefix)).map((m) => m.url.slice(prefix.length));
        const signedMap = new Map<string, string>();
        if (stored.length) {
          const { data: signed } = await supabaseAdmin.storage.from("catalog-images").createSignedUrls(stored, 60 * 60 * 6);
          (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl); });
        }
        for (const m of media ?? []) {
          const url = m.url.startsWith(prefix) ? signedMap.get(m.url.slice(prefix.length)) : /^https:\/\//i.test(m.url) ? m.url : undefined;
          if (!url) continue;
          const list = galleryByProduct.get(m.product_id) ?? [];
          list.push(url);
          galleryByProduct.set(m.product_id, list);
        }
      }
      const items: PublicQuotationItem[] = rows.map((r) => ({
        ...r.rest,
        video_embed_url: r.video_embed_url,
        gallery: r.productId ? galleryByProduct.get(r.productId) ?? [] : [],
      }));

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

      // Marca de la agencia emisora (v1.14 — multiagencia): la organización
      // propietaria manda; la configuración del usuario queda como respaldo.
      type OrgBranding = {
        trade_name: string | null;
        logo_path: string | null;
        address: string | null;
        whatsapp: string | null;
        email: string | null;
        website: string | null;
        primary_color: string | null;
        accent_color: string | null;
        footer_text: string | null;
        instagram: string | null;
        facebook: string | null;
      };
      let org: OrgBranding | null = null;

      if (organization_id) {
        const { data: orgRow } = await supabaseAdmin
          .from("organizations")
          .select(
            "trade_name, logo_path, address, whatsapp, email, website, primary_color, accent_color, footer_text, instagram, facebook",
          )
          .eq("id", organization_id)
          .maybeSingle();
        org = (orgRow as unknown as OrgBranding | null) ?? null;
      }

      const logoPath = org?.logo_path ?? settings?.logo_path ?? null;
      let logoUrl: string | null = null;
      if (logoPath) {
        const { data: signedLogo } = await supabaseAdmin.storage
          .from("company-logos")
          .createSignedUrl(logoPath, 60 * 60 * 24 * 7);
        logoUrl = signedLogo?.signedUrl ?? null;
      }

      const company: PublicCompany = {
        companyName: org?.trade_name ?? settings?.company_name ?? null,
        logoUrl,
        address: org?.address ?? settings?.address ?? null,
        whatsapp: org?.whatsapp ?? settings?.whatsapp ?? null,
        email: org?.email ?? settings?.email ?? null,
        website: org?.website ?? settings?.website ?? null,
        instagram: org?.instagram ?? settings?.instagram ?? null,
        facebook: org?.facebook ?? settings?.facebook ?? null,
        tiktok: settings?.tiktok ?? null,
        linkedin: settings?.linkedin ?? null,
        primaryColor: org?.primary_color ?? settings?.primary_color ?? "#1F4636",
        accentColor: org?.accent_color ?? settings?.accent_color ?? "#C4A264",
        footerText: org?.footer_text ?? settings?.footer_text ?? null,
      };

      let accommodationGallery = accProductId ? galleryByProduct.get(accProductId) ?? [] : [];
      // Unidad elegida con fotos propias: se muestran esas en lugar de las generales.
      const accUnitId = (q as { accommodation_unit_id?: string | null }).accommodation_unit_id ?? null;
      if (accProductId && accUnitId) {
        const { data: unit } = await supabaseAdmin.from("product_variants").select("metadata, product_id").eq("id", accUnitId).maybeSingle();
        const refs = unit?.product_id === accProductId ? ((unit?.metadata as { images?: unknown } | null)?.images ?? []) : [];
        const list = Array.isArray(refs) ? refs.filter((r): r is string => typeof r === "string") : [];
        if (list.length) {
          const pre = "storage://catalog-images/";
          const paths = list.filter((r) => r.startsWith(pre)).map((r) => r.slice(pre.length));
          const signed = new Map<string, string>();
          if (paths.length) {
            const { data: sg } = await supabaseAdmin.storage.from("catalog-images").createSignedUrls(paths, 60 * 60 * 6);
            (sg ?? []).forEach((x) => { if (x.path && x.signedUrl) signed.set(x.path, x.signedUrl); });
          }
          const urls = list
            .map((r) => (r.startsWith(pre) ? signed.get(r.slice(pre.length)) : /^https:\/\//i.test(r) ? r : undefined))
            .filter((u): u is string => !!u);
          if (urls.length) accommodationGallery = urls;
        }
      }
      // Enlace de Google Maps del producto del Catálogo (solo si es una URL https de Google).
      let accommodationMapsUrl: string | null = null;
      if (accProductId) {
        const { data: prod } = await supabaseAdmin.from("products").select("metadata").eq("id", accProductId).maybeSingle();
        const raw = (prod?.metadata as { maps_url?: unknown } | null)?.maps_url;
        if (typeof raw === "string" && /^https:\/\/([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)\//i.test(raw.trim())) accommodationMapsUrl = raw.trim();
      }
      // Coordenadas del pin: se leen del propio enlace de Google Maps (siguiendo la
      // redirección del enlace corto). Nunca se inventan; si no aparecen, no hay mapa.
      let accommodationMapCoords: { lat: number; lng: number } | null = null;
      if (accommodationMapsUrl) {
        try {
          let full = accommodationMapsUrl;
          if (/goo\.gl\//i.test(full)) {
            const res = await fetch(full, { redirect: "manual", signal: AbortSignal.timeout(4000) });
            full = res.headers.get("location") ?? full;
          }
          const decoded = decodeURIComponent(full);
          const pin = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
          const at = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
          const q = decoded.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
          const m = pin ?? q ?? at;
          if (m) {
            const lat = Number(m[1]);
            const lng = Number(m[2]);
            if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) accommodationMapCoords = { lat, lng };
          }
        } catch {
          accommodationMapCoords = null;
        }
      }
      const recommendations = recs.map((r) => ({ ...r, cover: galleryByProduct.get(r.product_id)?.[0] ?? null }));
      return { quotation, items, imageUrls, accommodationGallery, accommodationMapsUrl, accommodationMapCoords, recommendations, company };
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

/**
 * "Me interesa" de un recomendado desde el enlace público. Solo registra la
 * señal: no agrega servicios, no cambia precios ni el estado de la cotización.
 * Reutiliza el centro de notificaciones interno (campana) con los mismos
 * destinatarios que la respuesta del cliente: agente de la oportunidad + dueño.
 */
export const registerRecommendationInterest = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().regex(/^[a-f0-9]{20,64}$/i),
        productId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; already: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q, error } = await supabaseAdmin
      .from("quotations")
      .select("id, user_id, opportunity_id, organization_id, client_id, quotation_number, guest_first_name, guest_last_name, archived, recommendations, recommendation_interests")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error || !q || q.archived) throw new Error("Cotización no encontrada");
    const rec = readRecommendations(q.recommendations).find((r) => r.product_id === data.productId);
    if (!rec) throw new Error("Recomendado no encontrado");
    const interests = readRecommendationInterests(q.recommendation_interests);
    if (interests.some((i) => i.product_id === rec.product_id)) return { ok: true, already: true };
    const at = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin
      .from("quotations")
      .update({ recommendation_interests: [...interests, { product_id: rec.product_id, title: rec.title, at }] } as never)
      .eq("id", q.id);
    if (updErr) {
      console.error("recommendation interest failed", updErr);
      throw new Error("No se pudo registrar tu interés. Intentá de nuevo.");
    }

    let clientName = `${q.guest_first_name ?? ""} ${q.guest_last_name ?? ""}`.trim();
    if (q.client_id) {
      const { data: c } = await supabaseAdmin.from("clients").select("full_name, last_name").eq("id", q.client_id).maybeSingle();
      const n = `${c?.full_name ?? ""} ${c?.last_name ?? ""}`.trim();
      if (n) clientName = n;
    }
    clientName ||= "Cliente";
    const recipients = new Set<string>();
    if (q.opportunity_id) {
      const { data: o } = await supabaseAdmin.from("opportunities").select("assigned_agent_id").eq("id", q.opportunity_id).maybeSingle();
      if (o?.assigned_agent_id) {
        const { data: a } = await supabaseAdmin.from("agents").select("user_id").eq("id", o.assigned_agent_id).maybeSingle();
        if (a?.user_id) recipients.add(a.user_id);
      }
    }
    if (q.user_id) recipients.add(q.user_id);
    if (recipients.size) {
      const { error: nErr } = await supabaseAdmin.from("notifications").insert(
        [...recipients].map((user_id) => ({
          user_id,
          kind: "quotation_recommendation_interest",
          title: "Interés en un recomendado",
          body: `${clientName} · ${q.quotation_number ?? "Cotización"} · ${rec.title}`,
          entity: "quotations",
          entity_id: q.id,
          data: {
            quotation_number: q.quotation_number,
            client_name: clientName,
            product_id: rec.product_id,
            product_title: rec.title,
            at,
            organization_id: q.organization_id,
            link: `/quotations/${q.id}`,
          },
        })),
      );
      if (nErr) console.error("recommendation interest notification failed", nErr);
    }
    return { ok: true, already: false };
  });
