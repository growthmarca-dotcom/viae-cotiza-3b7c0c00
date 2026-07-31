import { supabase } from "@/integrations/supabase/client";
import type { QuotationFormState } from "@/components/quotation-form";

/**
 * Base del CRM: cada cotización genera/actualiza automáticamente un registro de cliente
 * con nombre, teléfono, email, destino, fechas, pasajeros y estado de la oportunidad.
 */
export async function upsertClientFromQuotation(
  userId: string,
  form: QuotationFormState,
): Promise<string | null> {
  const fullName = `${form.firstName} ${form.lastName}`.trim();
  if (!fullName) return null;

  const email = form.email.trim().toLowerCase() || null;
  const phone = form.whatsapp.trim() || null;

  const payload = {
    user_id: userId,
    full_name: fullName,
    email,
    phone,
    destination: form.destination || null,
    travel_start: form.travelStart || null,
    travel_end: form.travelEnd || null,
    pax_count: form.pax ? Number(form.pax) : null,
  };

  try {
    // Buscar cliente existente por email o teléfono dentro de la cuenta del agente
    let existingId: string | null = null;
    if (email) {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", userId)
        .eq("email", email)
        .maybeSingle();
      existingId = data?.id ?? null;
    }
    if (!existingId && phone) {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", userId)
        .eq("phone", phone)
        .maybeSingle();
      existingId = data?.id ?? null;
    }

    if (existingId) {
      await supabase.from("clients").update(payload).eq("id", existingId);
      return existingId;
    }

    const { data, error } = await supabase
      .from("clients")
      .insert({ ...payload, opportunity_status: "quoted" as const })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  } catch (err) {
    // El CRM no debe bloquear la creación de la cotización
    console.error("No se pudo sincronizar el cliente en el CRM", err);
    return null;
  }
}
