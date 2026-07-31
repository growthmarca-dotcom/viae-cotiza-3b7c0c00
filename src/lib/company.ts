import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CompanyRow = Tables<"company_settings">;

export type CompanyInfo = {
  companyName: string | null;
  logoUrl: string | null;
  address: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  linkedin: string | null;
  primaryColor: string;
  accentColor: string;
  footerText: string | null;
  /** Moneda en la que se expresan todas las estadísticas del sistema. */
  analysisCurrency: "ARS" | "USD";
};

export const DEFAULT_COMPANY: CompanyInfo = {
  companyName: "ViaE Sales Hub",
  logoUrl: null,
  address: null,
  whatsapp: null,
  email: null,
  website: null,
  instagram: null,
  facebook: null,
  tiktok: null,
  linkedin: null,
  primaryColor: "#1F4636",
  accentColor: "#C4A264",
  footerText: null,
  analysisCurrency: "USD",
};

export function rowToCompanyInfo(row: CompanyRow | null, logoUrl: string | null): CompanyInfo {
  if (!row) return { ...DEFAULT_COMPANY, logoUrl };
  return {
    companyName: row.company_name || DEFAULT_COMPANY.companyName,
    logoUrl,
    address: row.address,
    whatsapp: row.whatsapp,
    email: row.email,
    website: row.website,
    instagram: row.instagram,
    facebook: row.facebook,
    tiktok: row.tiktok,
    linkedin: row.linkedin,
    primaryColor: row.primary_color || DEFAULT_COMPANY.primaryColor,
    accentColor: row.accent_color || DEFAULT_COMPANY.accentColor,
    footerText: row.footer_text,
    analysisCurrency: (row.analysis_currency === "ARS" ? "ARS" : "USD"),
  };
}

export async function signLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("company-logos")
    .createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

/** Configuración de la empresa del usuario autenticado. */
export async function fetchCompany(): Promise<{ row: CompanyRow | null; info: CompanyInfo }> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { row: null, info: DEFAULT_COMPANY };

  const { data } = await supabase
    .from("company_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const logoUrl = await signLogoUrl(data?.logo_path ?? null);
  return { row: (data as CompanyRow | null) ?? null, info: rowToCompanyInfo((data as CompanyRow | null) ?? null, logoUrl) };
}

export async function uploadLogo(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${userId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("company-logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function saveCompany(
  userId: string,
  values: Partial<CompanyRow>,
): Promise<void> {
  const { error } = await supabase
    .from("company_settings")
    .upsert({ ...values, user_id: userId }, { onConflict: "user_id" });
  if (error) throw error;
}
