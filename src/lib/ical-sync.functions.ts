import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Convierte una fecha iCal (DATE o DATE-TIME) a YYYY-MM-DD. */
function icalDate(v: string): string | null {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parseIcalEvents(text: string) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const events: { uid: string; start: string; end: string; summary: string }[] = [];
  for (const chunk of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = chunk.split("END:VEVENT")[0];
    const get = (k: string) => body.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, "m"))?.[1]?.trim() ?? "";
    const start = icalDate(get("DTSTART"));
    let end = icalDate(get("DTEND"));
    if (!start) continue;
    if (!end || end <= start) {
      const d = new Date(start + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      end = d.toISOString().slice(0, 10);
    }
    events.push({ uid: get("UID") || `${start}_${end}`, start, end, summary: get("SUMMARY") });
  }
  return events;
}

/**
 * Importa un calendario iCal genérico como bloqueos externos (origen iCal).
 * No se interpreta como reserva ViaE. Reemplaza los bloqueos iCal previos de esa fuente.
 */
export const syncIcalSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: src, error } = await sb
      .from("availability_sources")
      .select("id, product_id, configuration")
      .eq("id", data.sourceId)
      .maybeSingle();
    if (error || !src?.product_id) throw new Error("Fuente iCal no encontrada o sin permisos.");
    const cfg = (src.configuration ?? {}) as Record<string, unknown>;
    const url = String(cfg.url ?? "").replace(/^webcal:\/\//i, "https://");
    const save = (extra: Record<string, unknown>) =>
      sb.from("availability_sources").update({ configuration: { ...cfg, ...extra } }).eq("id", src.id);

    try {
      if (!url) throw new Error("La fuente no tiene URL iCal.");
      const res = await fetch(url, { headers: { Accept: "text/calendar" } });
      if (!res.ok) throw new Error(`El calendario respondió ${res.status}`);
      const text = await res.text();
      if (!text.includes("BEGIN:VCALENDAR")) throw new Error("La URL no devolvió un calendario iCal válido.");
      const today = new Date().toISOString().slice(0, 10);
      const seen = new Set<string>();
      const events = parseIcalEvents(text).filter((e) => e.end >= today && !seen.has(e.uid) && !!seen.add(e.uid));

      const { error: delErr } = await sb
        .from("product_availability_blocks")
        .delete()
        .eq("source_id", src.id)
        .eq("origin", "ical");
      if (delErr) throw delErr;
      if (events.length) {
        const { error: insErr } = await sb.from("product_availability_blocks").insert(
          events.map((e) => ({
            product_id: src.product_id!,
            start_date: e.start,
            end_date: e.end,
            origin: "ical" as const,
            reason: e.summary || "Bloqueo externo (iCal)",
            source_id: src.id,
            external_uid: e.uid,
          })),
        );
        if (insErr) throw insErr;
      }
      await save({ last_sync_at: new Date().toISOString(), sync_status: "ok", sync_error: null });
      return { imported: events.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de sincronización";
      await save({ last_sync_at: new Date().toISOString(), sync_status: "error", sync_error: msg });
      throw new Error(msg);
    }
  });
