import { createFileRoute } from "@tanstack/react-router";

/** Sincronización automática de iCal (cada 30 min, llamada por el programador de tareas de la base). */
export const Route = createFileRoute("/api/public/ical-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-cron-token") ?? "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ok } = await supabaseAdmin.rpc("verify_cron_token", { _name: "ical_sync", _token: token });
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const { runIcalSync } = await import("@/lib/ical-sync.server");
        const { data: sources } = await supabaseAdmin
          .from("availability_sources")
          .select("id")
          .eq("enabled", true)
          .eq("source_type", "external")
          .eq("configuration->>kind", "ical")
          .not("product_id", "is", null);
        let synced = 0;
        let failed = 0;
        for (const s of sources ?? []) {
          try { await runIcalSync(supabaseAdmin, s.id); synced++; } catch { failed++; }
        }
        return Response.json({ synced, failed });
      },
    },
  },
});
