import { supabase } from "@/integrations/supabase/client";

/**
 * Backup / exportación a CSV.
 * Todo se resuelve en el navegador: se consulta la tabla respetando RLS
 * y se descarga un archivo con el contenido visible para el usuario actual.
 */

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = Array.isArray(value)
    ? value.join(" | ")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM para que Excel interprete correctamente los acentos
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const EXPORTABLE = [
  { table: "clients", label: "Clientes" },
  { table: "agents", label: "Agentes" },
  { table: "quotations", label: "Cotizaciones" },
  { table: "opportunities", label: "Oportunidades" },
  { table: "bookings", label: "Reservas" },
] as const;

export type ExportableTable = (typeof EXPORTABLE)[number]["table"];

/** Descarga una tabla completa en CSV. Devuelve la cantidad de filas exportadas. */
export async function exportTableCsv(table: ExportableTable): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (rows.length === 0) return 0;
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`viae-${table}-${stamp}.csv`, toCsv(rows));
  return rows.length;
}
