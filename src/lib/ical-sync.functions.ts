import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sincronización manual inmediata ("Sincronizar ahora"), con los permisos del usuario. */
export const syncIcalSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { runIcalSync } = await import("./ical-sync.server");
    return runIcalSync(context.supabase, data.sourceId);
  });
