import { useQuery } from "@tanstack/react-query";
import { fetchCompany } from "@/lib/company";
import type { AnalysisCurrency } from "@/lib/currency";

/**
 * Moneda en la que se expresan todas las estadísticas del sistema.
 * Se configura en Configuración de empresa y evita mezclar ARS con USD.
 */
export function useAnalysisCurrency(): AnalysisCurrency {
  const { data } = useQuery({
    queryKey: ["company-settings"],
    queryFn: fetchCompany,
    staleTime: 60_000,
  });
  return data?.info.analysisCurrency ?? "USD";
}
