import { useQuery } from "@tanstack/react-query";
import { isStoredCatalogImage, resolveCatalogImageUrl } from "@/lib/catalog";

/** Muestra una imagen del catálogo: URL externa directa o archivo propio con enlace firmado. */
export function CatalogImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const stored = isStoredCatalogImage(src);
  const { data } = useQuery({
    queryKey: ["catalog-image-url", src],
    enabled: stored,
    staleTime: 50 * 60 * 1000,
    queryFn: () => resolveCatalogImageUrl(src),
  });
  const url = stored ? data : src;
  if (!url) return <div className={`${className ?? ""} bg-muted`} aria-label={alt} />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
