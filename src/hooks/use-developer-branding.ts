import { useQuery } from "@tanstack/react-query";
import { fetchCompany } from "@/lib/company";

/**
 * Indica si debe mostrarse la firma del desarrollador en pantallas internas.
 * Configurable desde Configuración → Marca del desarrollador (v1.5).
 */
export function useDeveloperBranding(): boolean {
  const { data } = useQuery({
    queryKey: ["company-settings"],
    queryFn: fetchCompany,
    staleTime: 60_000,
  });
  return data?.info.showDeveloperBranding ?? true;
}
