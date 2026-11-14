import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { escapeCell, toCsv } from "./export";

describe("escapeCell", () => {
  it("keeps normal values", () => {
    expect(escapeCell("Hotel Centro")).toBe('"Hotel Centro"');
    expect(escapeCell(150)).toBe('"150"');
    expect(escapeCell('dice "hola"')).toBe('"dice ""hola"""');
  });
  it.each(["=SUM(A1)", "+CMD", "-2+3", "@IMPORT", "\tx", "\rx"])("neutralizes %j", (v) => {
    expect(escapeCell(v)).toBe(`"'${v}"`);
  });
  it("neutralizes booking and resource note fields in rows", () => {
    const csv = toCsv([{ notes: "=HYPERLINK(\"x\")", destination: "Bariloche" }]);
    expect(csv.split("\r\n")[1]).toBe('"\'=HYPERLINK(""x"")","Bariloche"');
  });
});
