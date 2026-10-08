import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const AUTOPLAY_MS = 4500;
const PAUSE_AFTER_INTERACTION_MS = 10000;

/** Galería pública: imagen grande con fundido suave, flechas, deslizamiento y autoavance. */
export type GalleryVideo = { url: string; vertical: boolean };

export function PublicGallery({ images, title, video }: { images: string[]; title: string; video?: GalleryVideo | null }) {
  const [idx, setIdx] = useState(0);
  const pausedUntil = useRef(0);
  const touchX = useRef<number | null>(null);
  // El video es un elemento más de la galería, al final de las fotos.
  const n = images.length + (video ? 1 : 0);
  const onVideo = !!video && idx === images.length;

  const go = useCallback((delta: number, manual = true) => {
    if (manual) pausedUntil.current = Date.now() + PAUSE_AFTER_INTERACTION_MS;
    setIdx((i) => (i + delta + n) % n);
  }, [n]);

  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => {
      if (!onVideo && Date.now() >= pausedUntil.current) go(1, false);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [n, go, onVideo]);

  if (n === 0) return null;

  return (
    <div
      data-testid="public-gallery"
      className={`relative mt-3 ${onVideo && video?.vertical ? "aspect-[9/16] max-h-[85vh] sm:aspect-[16/10]" : "aspect-[16/10]"} w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-muted`}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; pausedUntil.current = Date.now() + PAUSE_AFTER_INTERACTION_MS; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`${title} — foto ${i + 1} de ${n}`}
          loading={i === 0 ? "eager" : "lazy"}
          draggable={false}
          className={`absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-700 ease-in-out ${i === idx ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {video && onVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground">
          <iframe
            src={video.url}
            title={`Video: ${title}`}
            className={video.vertical ? "h-full aspect-[9/16] max-w-full" : "h-full w-full"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {n > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <span
            data-testid="gallery-counter"
            className="absolute bottom-2 right-2 z-10 rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-medium text-foreground backdrop-blur"
          >
            {idx + 1} / {n}
          </span>
        </>
      )}
    </div>
  );
}
