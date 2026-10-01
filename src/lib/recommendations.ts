/**
 * Recomendados: sugerencias de venta cruzada guardadas en la cotización.
 * NO son servicios contratados: no suman al total ni pasan a la reserva.
 * Se guarda una copia del texto del producto al momento de agregarlo; la foto
 * se lee del Catálogo (misma fuente que el resto de las galerías).
 */
export type QuotationRecommendation = {
  product_id: string;
  title: string;
  description: string;
  destination: string;
};

export type RecommendationInterest = { product_id: string; title: string; at: string };

export function readRecommendations(raw: unknown): QuotationRecommendation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        product_id: typeof o.product_id === "string" ? o.product_id : "",
        title: typeof o.title === "string" ? o.title : "",
        description: typeof o.description === "string" ? o.description : "",
        destination: typeof o.destination === "string" ? o.destination : "",
      };
    })
    .filter((r) => r.product_id && r.title);
}

export function readRecommendationInterests(raw: unknown): RecommendationInterest[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        product_id: typeof o.product_id === "string" ? o.product_id : "",
        title: typeof o.title === "string" ? o.title : "",
        at: typeof o.at === "string" ? o.at : "",
      };
    })
    .filter((r) => r.product_id);
}
