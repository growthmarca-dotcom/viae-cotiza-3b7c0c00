/**
 * Mapa estático e informativo: teselas de OpenStreetMap compuestas como
 * imágenes, con un marcador en las coordenadas del alojamiento. Sin enlaces,
 * iframes ni interacción (pointer-events: none). Funciona igual en web y PDF.
 */
const TILE = 256;

export function StaticAccommodationMap({
  lat,
  lng,
  zoom = 15,
  width = 560,
  height = 220,
  className = "",
}: { lat: number; lng: number; zoom?: number; width?: number; height?: number; className?: string }) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n * TILE;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * TILE;
  const left = x - width / 2;
  const top = y - height / 2;
  const tiles: { tx: number; ty: number }[] = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) tiles.push({ tx, ty });
  return (
    <div
      className={`static-map ${className}`}
      aria-label="Mapa de ubicación del alojamiento"
      role="img"
      style={{ position: "relative", overflow: "hidden", width: "100%", maxWidth: width, aspectRatio: `${width} / ${height}`, pointerEvents: "none", userSelect: "none" }}
    >
      <div style={{ position: "absolute", inset: 0, transform: `scale(var(--static-map-scale, 1))`, transformOrigin: "0 0" }}>
        <div style={{ position: "relative", width, height, containerType: "size" } as React.CSSProperties}>
          {tiles.map(({ tx, ty }) => (
            <img
              key={`${tx}-${ty}`}
              src={`https://tile.openstreetmap.org/${zoom}/${((tx % n) + n) % n}/${ty}.png`}
              alt=""
              draggable={false}
              loading="eager"
              style={{ position: "absolute", left: tx * TILE - left, top: ty * TILE - top, width: TILE, height: TILE, maxWidth: "none" }}
            />
          ))}
        </div>
      </div>
      <svg viewBox="0 0 24 32" width="28" height="38" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)" }} aria-hidden="true">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#c0392b" stroke="#fff" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="4.5" fill="#fff" />
      </svg>
      <span style={{ position: "absolute", right: 4, bottom: 2, fontSize: 9, color: "#555", background: "rgba(255,255,255,.75)", padding: "0 4px" }}>© OpenStreetMap</span>
    </div>
  );
}
