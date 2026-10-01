import { supabase } from "@/integrations/supabase/client";
import { resolveMyOrganizationIdSoft } from "@/lib/tenant";

/** Medios de pago que puede ofrecer una cotización (se guardan las claves). */
export const PAYMENT_METHODS = [
  { key: "cash", label: "Efectivo" },
  { key: "bank_transfer", label: "Transferencia bancaria" },
  { key: "credit_card", label: "Tarjeta de crédito" },
  { key: "debit_card", label: "Tarjeta de débito" },
  { key: "account_money", label: "Dinero en cuenta" },
  { key: "mercado_pago", label: "Mercado Pago" },
] as const;

/** Medios ofrecidos como opción al armar la cotización ("Dinero en cuenta" quedó retirado). */
export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.filter((m) => m.key !== "account_money");

/** Copia de una promoción guardada en la cotización (no cambia si luego se edita el catálogo). */
export type QuotationPromotion = { promotion_id: string | null; title: string; text: string };

/** Lee las promociones guardadas en una cotización; tolera datos vacíos o antiguos. */
export function readQuotationPromotions(raw: unknown): QuotationPromotion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        promotion_id: typeof o.promotion_id === "string" ? o.promotion_id : null,
        title: typeof o.title === "string" ? o.title : "",
        text: typeof o.text === "string" ? o.text : "",
      };
    })
    .filter((p) => p.title.trim() || p.text.trim());
}

/** Etiquetas de los medios guardados, en el orden canónico; ignora claves desconocidas. */
export function paymentMethodLabels(keys: readonly string[] | null | undefined): string[] {
  const set = new Set(keys ?? []);
  return PAYMENT_METHODS.filter((m) => set.has(m.key)).map((m) => m.label);
}

export type Promotion = {
  id: string;
  organization_id: string | null;
  title: string;
  description: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
};

export type PromotionInput = {
  title: string;
  description: string;
  is_active: boolean;
  valid_from: string;
  valid_to: string;
};

export async function listPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select("id, organization_id, title, description, is_active, valid_from, valid_to, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Promotion[];
}

/** Activa y dentro de su vigencia (si la tiene) a la fecha de hoy. */
export function isPromotionAvailable(p: Promotion, today = new Date().toISOString().slice(0, 10)) {
  if (!p.is_active) return false;
  if (p.valid_from && today < p.valid_from) return false;
  if (p.valid_to && today > p.valid_to) return false;
  return true;
}

function toRow(input: PromotionInput) {
  const title = input.title.trim();
  if (!title) throw new Error("El nombre de la promoción es obligatorio.");
  if (input.valid_from && input.valid_to && input.valid_to < input.valid_from) {
    throw new Error("La vigencia 'hasta' no puede ser anterior a 'desde'.");
  }
  return {
    title,
    description: input.description.trim() || null,
    is_active: input.is_active,
    valid_from: input.valid_from || null,
    valid_to: input.valid_to || null,
  };
}

export async function createPromotion(input: PromotionInput) {
  const organization_id = await resolveMyOrganizationIdSoft();
  const { error } = await supabase.from("promotions").insert({ ...toRow(input), organization_id });
  if (error) throw error;
}

export async function updatePromotion(id: string, input: PromotionInput) {
  const { error } = await supabase
    .from("promotions")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function setPromotionActive(id: string, is_active: boolean) {
  const { error } = await supabase
    .from("promotions")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
