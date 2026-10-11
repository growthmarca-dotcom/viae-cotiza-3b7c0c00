import { supabase } from "@/integrations/supabase/client";

/**
 * Tarifas de alojamiento por período (reutiliza product_pricing_profiles + pricing_rules).
 * Período = perfil con valid_from (primera noche) y valid_until (última noche, incluida);
 * product_variant_id vacío = tarifa general. Regla fixed/per_unit: value = precio por noche,
 * min_quantity = estadía mínima. El cálculo oficial lo hace accommodation_rate_quote en la base.
 */
export type RatePeriod = {
  id: string;
  ruleId: string | null;
  name: string;
  unitId: string | null;
  from: string;
  to: string; // última noche incluida
  currency: string;
  price: number;
  minNights: number;
  active: boolean;
};

export type RateQuote = {
  ok: boolean;
  has_rates?: boolean;
  error?: string;
  nights_count?: number;
  nights?: { date: string; price: number; currency: string; period_name: string; level: "unit" | "general" }[];
  missing?: string[];
  conflicts?: string[];
  total?: number;
  currency?: string | null;
  mixed_currency?: boolean;
  min_stay?: number;
  min_stay_ok?: boolean;
};

export async function listRatePeriods(productId: string): Promise<RatePeriod[]> {
  const { data, error } = await supabase
    .from("product_pricing_profiles")
    .select("id, name, product_variant_id, valid_from, valid_until, currency, status, pricing_rules(id, value, min_quantity, rule_type, active)")
    .eq("product_id", productId)
    .neq("status", "archived")
    .order("valid_from");
  if (error) throw error;
  return (data ?? []).map((p) => {
    const r = (p.pricing_rules ?? []).find((x) => x.rule_type === "fixed");
    return {
      id: p.id,
      ruleId: r?.id ?? null,
      name: p.name,
      unitId: p.product_variant_id,
      from: p.valid_from ?? "",
      to: p.valid_until ?? "",
      currency: p.currency,
      price: Number(r?.value ?? 0),
      minNights: r?.min_quantity ?? 1,
      active: p.status === "active" && !!r?.active,
    };
  });
}

/** Superposiciones entre períodos activos del mismo nivel (misma unidad o ambos generales). */
export function findOverlaps(periods: RatePeriod[]): Set<string> {
  const ids = new Set<string>();
  const act = periods.filter((p) => p.active && p.from && p.to);
  for (let i = 0; i < act.length; i++)
    for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j];
      if (a.unitId === b.unitId && a.from <= b.to && b.from <= a.to) { ids.add(a.id); ids.add(b.id); }
    }
  return ids;
}

export type RatePeriodInput = Omit<RatePeriod, "id" | "ruleId" | "active">;

function validate(i: RatePeriodInput) {
  if (!i.from || !i.to) throw new Error("Indicá la primera y la última noche del período.");
  if (i.to < i.from) throw new Error("La última noche debe ser igual o posterior a la primera.");
  if (!(i.price >= 0)) throw new Error("El precio por noche debe ser 0 o mayor.");
  if (!(i.minNights >= 1)) throw new Error("La estadía mínima debe ser de al menos 1 noche.");
  if (!i.currency) throw new Error("Elegí la moneda.");
}

export async function saveRatePeriod(productId: string, input: RatePeriodInput, current?: RatePeriod) {
  validate(input);
  const profile = {
    name: input.name.trim() || `Tarifa ${input.from}`,
    product_variant_id: input.unitId,
    valid_from: input.from,
    valid_until: input.to,
    currency: input.currency,
    status: "active" as const,
  };
  const rule = { rule_type: "fixed" as const, calculation_type: "per_unit" as const, value: input.price, min_quantity: input.minNights, currency: input.currency, active: true };
  if (current) {
    const { error } = await supabase.from("product_pricing_profiles").update(profile).eq("id", current.id);
    if (error) throw error;
    const r = current.ruleId
      ? await supabase.from("pricing_rules").update(rule).eq("id", current.ruleId)
      : await supabase.from("pricing_rules").insert({ ...rule, pricing_profile_id: current.id });
    if (r.error) throw r.error;
    return;
  }
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sesión no válida");
  const { data, error } = await supabase
    .from("product_pricing_profiles")
    .insert({ ...profile, product_id: productId, user_id: u.user.id })
    .select("id")
    .single();
  if (error) throw error;
  const r = await supabase.from("pricing_rules").insert({ ...rule, pricing_profile_id: data.id });
  if (r.error) {
    await supabase.from("product_pricing_profiles").delete().eq("id", data.id);
    throw r.error;
  }
}

export async function deleteRatePeriod(id: string) {
  const { error } = await supabase.from("product_pricing_profiles").delete().eq("id", id);
  if (error) throw error;
}

export async function quoteAccommodationRate(productId: string, unitId: string | null, from: string, to: string) {
  const { data, error } = await supabase.rpc("accommodation_rate_quote", {
    _product_id: productId,
    _unit_id: (unitId || null) as string,
    _from: from,
    _to: to,
  });
  if (error) throw error;
  return data as unknown as RateQuote;
}
