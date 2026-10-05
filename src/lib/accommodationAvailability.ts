import { supabase } from "@/integrations/supabase/client";

/**
 * Calendario interno de disponibilidad de alojamientos del Catálogo.
 * - Unidades/habitaciones = `product_variants` (sin unidades = alojamiento de una sola unidad).
 * - Gestión de calendario activa = `product_availability_profiles` (modo calendar, activo).
 * - iCal = `availability_sources` (source_type external, configuration.kind = "ical").
 * - Bloqueos = `product_availability_blocks` (fecha hasta = check-out, exclusiva).
 * "Disponible" significa verificado según la información cargada en ViaE; no reserva nada.
 */

export type BlockOrigin =
  | "manual"
  | "viae_booking"
  | "ical"
  | "booking_engine"
  | "channel_manager"
  | "api"
  | "other";

export const BLOCK_ORIGIN_LABELS: Record<BlockOrigin, string> = {
  manual: "Manual",
  viae_booking: "Reserva ViaE",
  ical: "iCal",
  booking_engine: "Motor de reservas",
  channel_manager: "Channel manager",
  api: "API",
  other: "Otro",
};

/** Orígenes que hoy se pueden cargar a mano. */
export const MANUAL_ORIGINS: BlockOrigin[] = ["manual"];

export type AvailabilityUnit = { id: string; name: string; status: string };
export type AvailabilityBlock = {
  id: string;
  product_variant_id: string | null;
  start_date: string;
  end_date: string;
  origin: BlockOrigin;
  reason: string | null;
  booking_id: string | null;
};
export type IcalSource = {
  id: string;
  enabled: boolean;
  url: string;
  last_sync_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
};

export type AvailabilityState = "available" | "unknown" | "unavailable";

export async function getAvailabilityOverview(productId: string) {
  const [units, blocks, profile, source] = await Promise.all([
    supabase.from("product_variants").select("id, name, status").eq("product_id", productId).order("created_at"),
    supabase
      .from("product_availability_blocks")
      .select("id, product_variant_id, start_date, end_date, origin, reason, booking_id")
      .eq("product_id", productId)
      .order("start_date"),
    supabase
      .from("product_availability_profiles")
      .select("id, status, availability_mode")
      .eq("product_id", productId)
      .eq("availability_mode", "calendar")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("availability_sources")
      .select("id, enabled, configuration")
      .eq("product_id", productId)
      .eq("source_type", "external")
      .limit(1)
      .maybeSingle(),
  ]);
  for (const r of [units, blocks, profile, source]) if (r.error) throw r.error;
  const cfg = (source.data?.configuration ?? {}) as Record<string, unknown>;
  const ical: IcalSource | null = source.data
    ? {
        id: source.data.id,
        enabled: source.data.enabled,
        url: String(cfg.url ?? ""),
        last_sync_at: (cfg.last_sync_at as string) ?? null,
        sync_status: (cfg.sync_status as string) ?? null,
        sync_error: (cfg.sync_error as string) ?? null,
      }
    : null;
  return {
    units: (units.data ?? []) as AvailabilityUnit[],
    blocks: (blocks.data ?? []) as AvailabilityBlock[],
    profileId: profile.data?.id ?? null,
    managed: profile.data?.status === "active",
    ical,
  };
}

export async function setCalendarManaged(productId: string, profileId: string | null, managed: boolean) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sesión no válida");
  if (profileId) {
    const { error } = await supabase
      .from("product_availability_profiles")
      .update({ status: managed ? "active" : "inactive" })
      .eq("id", profileId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("product_availability_profiles").insert({
    product_id: productId,
    user_id: u.user.id,
    name: "Calendario interno ViaE",
    availability_mode: "calendar",
    status: managed ? "active" : "inactive",
  });
  if (error) throw error;
}

export async function addUnit(productId: string, name: string) {
  const { error } = await supabase.from("product_variants").insert({ product_id: productId, name, status: "active" });
  if (error) throw error;
}

export async function removeUnit(id: string) {
  const { error } = await supabase.from("product_variants").update({ status: "inactive" }).eq("id", id);
  if (error) throw error;
}

export async function addBlock(input: {
  productId: string;
  unitId: string | null;
  from: string;
  to: string;
  reason: string;
}) {
  if (!input.from || !input.to) throw new Error("Indicá fecha desde y hasta.");
  if (input.to <= input.from) throw new Error("La fecha hasta debe ser posterior a la fecha desde.");
  const { error } = await supabase.from("product_availability_blocks").insert({
    product_id: input.productId,
    product_variant_id: input.unitId,
    start_date: input.from,
    end_date: input.to,
    origin: "manual",
    reason: input.reason.trim() || null,
  });
  if (error) throw error;
}

export async function removeBlock(id: string) {
  const { error } = await supabase.from("product_availability_blocks").delete().eq("id", id).eq("origin", "manual");
  if (error) throw error;
}

export async function saveIcalSource(args: {
  productId: string;
  organizationId: string | null;
  current: IcalSource | null;
  url: string;
  enabled: boolean;
}) {
  const url = args.url.trim();
  if (url && !/^(https?|webcal):\/\//i.test(url)) throw new Error("La URL iCal debe empezar con https:// o webcal://");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sesión no válida");
  const configuration = {
    kind: "ical",
    url,
    last_sync_at: args.current?.last_sync_at ?? null,
    sync_status: args.current?.sync_status ?? null,
    sync_error: args.current?.sync_error ?? null,
  };
  if (args.current) {
    const { error } = await supabase
      .from("availability_sources")
      .update({ configuration, enabled: args.enabled && !!url })
      .eq("id", args.current.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("availability_sources").insert({
    product_id: args.productId,
    organization_id: args.organizationId,
    owner_id: u.user.id,
    source_type: "external",
    source_name: "iCal",
    enabled: args.enabled && !!url,
    configuration,
  });
  if (error) throw error;
}

/** Estado de disponibilidad de varios alojamientos para un rango (check-out exclusivo). */
export async function getAvailabilityStatuses(
  productIds: string[],
  from: string,
  to: string,
): Promise<Record<string, AvailabilityState>> {
  if (!productIds.length || !from || !to || to <= from) return {};
  const { data, error } = await supabase.rpc("product_availability_status", {
    _product_ids: productIds,
    _from: from,
    _to: to,
  });
  if (error) throw error;
  return Object.fromEntries(
    ((data ?? []) as { product_id: string; status: AvailabilityState }[]).map((r) => [r.product_id, r.status]),
  );
}

/** Días ocupados (por todo el alojamiento o por todas sus unidades) en un rango. */
export function occupiedDays(blocks: AvailabilityBlock[], units: AvailabilityUnit[], unitId: string | "all") {
  const active = units.filter((u) => u.status === "active");
  const days = new Set<string>();
  const each = (b: AvailabilityBlock, fn: (d: string) => void) => {
    const d = new Date(b.start_date + "T00:00:00");
    const end = new Date(b.end_date + "T00:00:00");
    while (d < end) {
      fn(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  };
  if (unitId !== "all") {
    for (const b of blocks) if (b.product_variant_id === null || b.product_variant_id === unitId) each(b, (d) => days.add(d));
    return days;
  }
  if (active.length === 0) {
    for (const b of blocks) each(b, (d) => days.add(d));
    return days;
  }
  const perUnit = new Map<string, Set<string>>();
  for (const b of blocks) {
    each(b, (d) => {
      if (b.product_variant_id === null) days.add(d);
      else {
        if (!perUnit.has(d)) perUnit.set(d, new Set());
        perUnit.get(d)!.add(b.product_variant_id);
      }
    });
  }
  for (const [d, set] of perUnit) if (active.every((u) => set.has(u.id))) days.add(d);
  return days;
}
