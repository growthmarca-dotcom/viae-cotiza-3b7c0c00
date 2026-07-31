import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;

export type ClientStatus =
  | "new"
  | "contacted"
  | "quoted"
  | "negotiating"
  | "won"
  | "confirmed"
  | "lost"
  | "cancelled"
  | "expired";

/** Estados comerciales del CRM, en el orden en el que se muestran. */
export const CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "new", label: "Nuevo" },
  { value: "contacted", label: "Contactado" },
  { value: "quoted", label: "Cotización enviada" },
  { value: "negotiating", label: "En seguimiento" },
  { value: "won", label: "Aceptada" },
  { value: "confirmed", label: "Confirmada" },
  { value: "lost", label: "Perdida" },
  { value: "cancelled", label: "Cancelada" },
  { value: "expired", label: "Vencida" },
];

export function statusLabel(value: string) {
  return CLIENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function statusClasses(value: string) {
  switch (value) {
    case "won":
    case "confirmed":
      return "bg-primary/10 text-primary border-primary/30";
    case "lost":
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "expired":
      return "bg-muted text-muted-foreground border-border";
    case "quoted":
    case "negotiating":
      return "bg-gold/15 text-foreground border-gold/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Separa el nombre completo almacenado en `full_name` usando el apellido guardado. */
export function splitName(client: Pick<Client, "full_name" | "last_name">) {
  const full = (client.full_name ?? "").trim();
  const last = (client.last_name ?? "").trim();
  if (last && full.toLowerCase().endsWith(last.toLowerCase())) {
    return { firstName: full.slice(0, full.length - last.length).trim(), lastName: last };
  }
  return { firstName: full, lastName: last };
}

export function composeFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export type ClientInput = {
  firstName: string;
  lastName: string;
  company: string;
  whatsapp: string;
  email: string;
  city: string;
  country: string;
  notes: string;
  status: ClientStatus;
};

export const EMPTY_CLIENT: ClientInput = {
  firstName: "",
  lastName: "",
  company: "",
  whatsapp: "",
  email: "",
  city: "",
  country: "",
  notes: "",
  status: "new",
};

export function clientToInput(c: Client): ClientInput {
  const { firstName, lastName } = splitName(c);
  return {
    firstName,
    lastName,
    company: c.company ?? "",
    whatsapp: c.phone ?? "",
    email: c.email ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
    notes: c.notes ?? "",
    status: (c.opportunity_status as ClientStatus) ?? "new",
  };
}

export function inputToRow(input: ClientInput, userId: string) {
  return {
    user_id: userId,
    full_name: composeFullName(input.firstName, input.lastName),
    last_name: input.lastName.trim() || null,
    company: input.company.trim() || null,
    phone: input.whatsapp.trim() || null,
    email: input.email.trim().toLowerCase() || null,
    city: input.city.trim() || null,
    country: input.country.trim() || null,
    notes: input.notes.trim() || null,
    opportunity_status: input.status,
  };
}

/**
 * Estado de archivo del registro. Los clientes nunca se eliminan:
 * sólo cambian entre Activo, Archivado, Inactivo o Suspendido.
 */
export type RecordStatus = "active" | "archived" | "inactive" | "suspended";

export const RECORD_STATUSES: { value: RecordStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "archived", label: "Archivado" },
  { value: "inactive", label: "Inactivo" },
  { value: "suspended", label: "Suspendido" },
];

export function recordStatusLabel(value: string) {
  return RECORD_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function recordStatusClasses(value: string) {
  switch (value) {
    case "active":
      return "bg-primary/10 text-primary border-primary/30";
    case "suspended":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "archived":
    case "inactive":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export async function listClients(recordStatus: RecordStatus | "all" = "active") {
  let q = supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (recordStatus !== "all") q = q.eq("record_status", recordStatus);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function getClient(id: string) {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Client | null;
}

export async function createClient(input: ClientInput, userId: string) {
  const { data, error } = await supabase
    .from("clients")
    .insert(inputToRow(input, userId))
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateClient(id: string, input: ClientInput, userId: string) {
  const { error } = await supabase.from("clients").update(inputToRow(input, userId)).eq("id", id);
  if (error) throw error;
}

export async function updateClientStatus(id: string, status: ClientStatus) {
  const { error } = await supabase
    .from("clients")
    .update({ opportunity_status: status })
    .eq("id", id);
  if (error) throw error;
}

/** Los clientes nunca se eliminan definitivamente: sólo se archivan. */
export async function setClientRecordStatus(id: string, recordStatus: RecordStatus) {
  const { error } = await supabase.from("clients").update({ record_status: recordStatus }).eq("id", id);
  if (error) throw error;
}
