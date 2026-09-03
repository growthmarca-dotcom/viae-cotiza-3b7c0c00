import { describe, expect, it } from "vitest";
import {
  beneficiaryState,
  beneficiaryStateLabel,
  type BeneficiaryAuthorization,
} from "./beneficiaryAuthorizations";
import { personDisplayName, PERSON_ROLE_TYPES, personRoleLabel } from "./persons";
import { EMPTY_AGENT, type AgentInput } from "./agents";

function auth(over: Partial<BeneficiaryAuthorization>): BeneficiaryAuthorization {
  return {
    id: "a1",
    organization_id: null,
    beneficiary_type: "agent",
    beneficiary_id: "b1",
    status: "authorized",
    authorized_at: "2026-01-01T00:00:00Z",
    authorized_by: "u1",
    revoked_at: null,
    revoked_by: null,
    reason: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as BeneficiaryAuthorization;
}

describe("estado de beneficiario", () => {
  it("sin autorización previa es 'nunca autorizado'", () => {
    expect(beneficiaryState(null)).toBe("never");
    expect(beneficiaryStateLabel("never")).toBe("Nunca autorizado");
  });

  it("una autorización activa habilita al beneficiario", () => {
    expect(beneficiaryState(auth({ status: "authorized" }))).toBe("authorized");
  });

  it("una autorización revocada conserva su trazabilidad y no habilita", () => {
    const revoked = auth({
      status: "revoked",
      revoked_at: "2026-02-01T00:00:00Z",
      revoked_by: "u2",
      reason: "cese del acuerdo",
    });
    expect(beneficiaryState(revoked)).toBe("revoked");
    expect(revoked.authorized_at).toBe("2026-01-01T00:00:00Z");
    expect(revoked.revoked_by).toBe("u2");
    expect(revoked.reason).toBe("cese del acuerdo");
  });
});

describe("modelo obsoleto de comisión del agente", () => {
  it("el formulario de agente ya no expone commission_* ni settlement_authorized", () => {
    const keys = Object.keys(EMPTY_AGENT) as (keyof AgentInput | string)[];
    expect(keys).not.toContain("commission_type");
    expect(keys).not.toContain("commission_value");
    expect(keys).not.toContain("commission_currency");
    expect(keys).not.toContain("settlement_authorized");
  });
});

describe("identidad maestra de personas", () => {
  it("muestra nombre completo y usa contacto como reserva", () => {
    expect(
      personDisplayName({ first_name: "Ana", last_name: "Pérez", email: null, phone: null }),
    ).toBe("Ana Pérez");
    expect(
      personDisplayName({
        first_name: "",
        last_name: null,
        email: "ana@viae.com",
        phone: null,
      }),
    ).toBe("ana@viae.com");
  });

  it("expone los roles de persona disponibles", () => {
    expect(PERSON_ROLE_TYPES.map((r) => r.value)).toContain("agent");
    expect(personRoleLabel("customer")).toBe("Cliente");
  });
});
