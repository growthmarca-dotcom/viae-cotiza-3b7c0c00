import { describe, expect, it } from "vitest";
import { clientCanRespond } from "./public-quotation.functions";
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  isQuotationExpired,
  type QuotationStatus,
} from "./quotationStatus";

describe("transiciones de estado de cotización", () => {
  it("permite el flujo comercial draft → sent → accepted", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "accepted")).toBe(true);
  });

  it("permite el flujo draft → sent → rejected", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "rejected")).toBe(true);
  });

  it("no permite saltar de borrador a aceptada o rechazada", () => {
    expect(canTransition("draft", "accepted")).toBe(false);
    expect(canTransition("draft", "rejected")).toBe(false);
  });

  it("trata 'accepted' como estado terminal", () => {
    expect(ALLOWED_TRANSITIONS.accepted).toEqual([]);
    for (const to of ["draft", "sent", "pending", "rejected", "expired"] as QuotationStatus[]) {
      expect(canTransition("accepted", to)).toBe(false);
    }
  });

  it("nunca vuelve silenciosamente a borrador", () => {
    for (const from of ["sent", "pending", "accepted", "rejected", "expired"] as QuotationStatus[]) {
      expect(canTransition(from, "draft")).toBe(false);
    }
  });

  it("permite reenviar una cotización rechazada o vencida", () => {
    expect(canTransition("rejected", "sent")).toBe(true);
    expect(canTransition("expired", "sent")).toBe(true);
  });

  it("acepta el mismo estado como operación idempotente", () => {
    expect(canTransition("sent", "sent")).toBe(true);
    expect(canTransition("accepted", "accepted")).toBe(true);
  });
});

describe("expiración por expires_at", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("vence una cotización enviada con validez pasada", () => {
    expect(isQuotationExpired({ status: "sent", expires_at: "2026-06-01" }, now)).toBe(true);
  });

  it("no vence sin fecha de validez", () => {
    expect(isQuotationExpired({ status: "sent", expires_at: null }, now)).toBe(false);
  });

  it("no vence una cotización ya cerrada", () => {
    expect(isQuotationExpired({ status: "accepted", expires_at: "2026-06-01" }, now)).toBe(false);
    expect(isQuotationExpired({ status: "rejected", expires_at: "2026-06-01" }, now)).toBe(false);
  });

  it("no vence si la validez es futura", () => {
    expect(isQuotationExpired({ status: "draft", expires_at: "2026-07-01" }, now)).toBe(false);
  });
});

describe("respuesta pública del cliente", () => {
  it("permite responder sólo cuando la cotización fue enviada o está pendiente", () => {
    expect(clientCanRespond("sent")).toBe(true);
    expect(clientCanRespond("pending")).toBe(true);
  });

  it("no permite responder en borrador ni en estados terminales", () => {
    for (const s of ["draft", "accepted", "rejected", "expired"]) {
      expect(clientCanRespond(s)).toBe(false);
    }
  });
});
