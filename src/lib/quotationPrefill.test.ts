import { describe, expect, it } from "vitest";
import { quotationInitialFromContext } from "./quotationPrefill";
import type { Lead } from "@/lib/leads";
import type { Opportunity } from "@/lib/opportunities";

const lead = {
  first_name: "Juan",
  last_name: "Pérez",
  email: "juan@example.com",
  whatsapp: "+54 9 11 1234",
  destination: "San Martín de los Andes",
  travel_date: "2026-11-10",
  nights_count: 5,
  pax_count: 2,
  budget_currency: "ARS",
  notes: "Consulta web",
  commercial_notes: null,
} as unknown as Lead;

describe("quotationInitialFromContext", () => {
  it("Test 1: precarga los datos de la Consulta", () => {
    const initial = quotationInitialFromContext({ lead });
    expect(initial).toMatchObject({
      firstName: "Juan",
      lastName: "Pérez",
      destination: "San Martín de los Andes",
      travelStart: "2026-11-10",
      travelEnd: "2026-11-15",
      nights: "5",
      pax: "2",
      currency: "ARS",
    });
  });

  it("Test 2: sin contexto no genera valores iniciales", () => {
    expect(quotationInitialFromContext({})).toBeUndefined();
  });

  it("usa el cliente de la oportunidad cuando no hay Consulta", () => {
    const initial = quotationInitialFromContext({
      opportunity: { currency: "USD", notes: "Pipeline" } as unknown as Opportunity,
      client: {
        full_name: "Ana",
        last_name: "Gómez",
        email: "ana@example.com",
        phone: "+54 11",
      } as never,
    });
    expect(initial).toMatchObject({
      firstName: "Ana",
      lastName: "Gómez",
      email: "ana@example.com",
      whatsapp: "+54 11",
      currency: "USD",
      observations: "Pipeline",
    });
  });
});
