import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Pasajeros de la reserva — v1.9.5 Fase 1.
 *
 * Parte del Expediente de Viaje 360°: la reserva pasa a conocer a las
 * personas que viajan, sin duplicar los datos comerciales del cliente
 * (que siguen viviendo en `clients`).
 *
 * Datos personales sensibles: nunca se exponen en el enlace público de
 * seguimiento ni en las cotizaciones públicas. El recorte lo hace RLS.
 */

export type BookingPassenger = Tables<"booking_passengers">;

export const DOCUMENT_TYPES = [
  { value: "dni", label: "DNI" },
  { value: "passport", label: "Pasaporte" },
  { value: "ci", label: "Cédula de identidad" },
  { value: "other", label: "Otro" },
];

export function documentTypeLabel(value: string | null) {
  if (!value) return "—";
  return DOCUMENT_TYPES.find((d) => d.value === value)?.label ?? value;
}

/** Relación con el pasajero titular. Campo opcional y libre. */
export const RELATIONSHIPS = [
  "Titular",
  "Cónyuge",
  "Hijo/a",
  "Padre/Madre",
  "Familiar",
  "Acompañante",
  "Otro",
];

export type PassengerInput = {
  first_name: string;
  last_name: string;
  document_type: string | null;
  document_number: string | null;
  birth_date: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  is_lead_passenger: boolean;
  relationship_to_lead_passenger: string | null;
  notes: string | null;
};

export function emptyPassenger(): PassengerInput {
  return {
    first_name: "",
    last_name: "",
    document_type: null,
    document_number: null,
    birth_date: null,
    nationality: null,
    email: null,
    phone: null,
    is_lead_passenger: false,
    relationship_to_lead_passenger: null,
    notes: null,
  };
}

export function passengerFullName(p: BookingPassenger) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}

/** Edad calculada a la fecha de hoy; null si no hay fecha de nacimiento. */
export function passengerAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export async function listPassengers(bookingId: string): Promise<BookingPassenger[]> {
  const { data, error } = await supabase
    .from("booking_passengers")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("record_status", "active")
    .order("is_lead_passenger", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookingPassenger[];
}

function normalize(input: PassengerInput) {
  const clean = (v: string | null) => {
    const t = v?.trim();
    return t ? t : null;
  };
  return {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    document_type: clean(input.document_type),
    document_number: clean(input.document_number),
    birth_date: clean(input.birth_date),
    nationality: clean(input.nationality),
    email: clean(input.email),
    phone: clean(input.phone),
    is_lead_passenger: input.is_lead_passenger,
    relationship_to_lead_passenger: clean(input.relationship_to_lead_passenger),
    notes: clean(input.notes),
  };
}

export async function createPassenger(bookingId: string, input: PassengerInput): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sesión no válida");
  if (!input.first_name.trim() || !input.last_name.trim()) {
    throw new Error("Nombre y apellido son obligatorios");
  }

  const { data, error } = await supabase
    .from("booking_passengers")
    .insert({ ...normalize(input), booking_id: bookingId, user_id: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updatePassenger(id: string, input: PassengerInput) {
  if (!input.first_name.trim() || !input.last_name.trim()) {
    throw new Error("Nombre y apellido son obligatorios");
  }
  const { error } = await supabase
    .from("booking_passengers")
    .update(normalize(input))
    .eq("id", id);
  if (error) throw error;
}

/** Los pasajeros no se borran: se archivan, igual que el resto del sistema. */
export async function archivePassenger(id: string) {
  const { error } = await supabase
    .from("booking_passengers")
    .update({ record_status: "archived" })
    .eq("id", id);
  if (error) throw error;
}
