import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const getPublicQuotation = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().min(10).max(100) }).parse(data))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: q, error } = await supabase
      .from("quotations")
      .select("*")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Cotización no encontrada");

    let imageUrls: string[] = [];
    if (q.images && q.images.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from("quotation-images")
        .createSignedUrls(q.images, 60 * 60 * 24 * 7);
      imageUrls = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
    }
    return { quotation: q, imageUrls };
  });
