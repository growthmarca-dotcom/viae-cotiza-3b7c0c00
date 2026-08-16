import type { QuotationFormState } from "@/components/quotation-form";
import type { Client } from "@/lib/clients";
import type { Lead } from "@/lib/leads";
import type { Opportunity } from "@/lib/opportunities";

/**
 * Valores iniciales del formulario de cotización cuando se inicia desde una
 * Consulta y/o una Oportunidad del Pipeline. Solo produce valores iniciales:
 * el estado del formulario luego pertenece al usuario.
 */
export function quotationInitialFromContext(args: {
  lead?: Lead | null;
  opportunity?: Opportunity | null;
  client?: Client | null;
}): Partial<QuotationFormState> | undefined {
  const { lead, opportunity, client } = args;
  if (!lead && !opportunity && !client) return undefined;

  const firstName =
    lead?.first_name?.trim() ||
    (client?.full_name ?? "").trim() ||
    "";
  const lastName = lead?.last_name?.trim() || (client?.last_name ?? "").trim() || "";

  const initial: Partial<QuotationFormState> = {
    firstName,
    lastName,
    email: lead?.email ?? client?.email ?? "",
    whatsapp: lead?.whatsapp ?? client?.phone ?? "",
    destination: lead?.destination ?? "",
    travelStart: lead?.travel_date ?? "",
    nights: lead?.nights_count != null ? String(lead.nights_count) : "",
    pax: lead?.pax_count != null ? String(lead.pax_count) : "",
    currency: lead?.budget_currency ?? opportunity?.currency ?? "USD",
    observations: [lead?.notes, lead?.commercial_notes, !lead ? opportunity?.notes : null]
      .filter(Boolean)
      .join("\n"),
  };

  // Fecha de salida derivada de la fecha de inicio + noches, si es posible.
  if (initial.travelStart && lead?.nights_count) {
    const start = new Date(`${initial.travelStart}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      start.setDate(start.getDate() + lead.nights_count);
      initial.travelEnd = start.toISOString().slice(0, 10);
    }
  }

  return initial;
}
