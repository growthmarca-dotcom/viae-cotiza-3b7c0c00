/**
 * Footer interno de la aplicación (v1.5).
 * Sólo se muestra en pantallas internas/administrativas. Nunca en las
 * cotizaciones públicas ni en los PDF enviados al cliente.
 * La marca del desarrollador se puede ocultar desde Configuración.
 */
export function AppFooter({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <footer
      data-print-hide
      className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground md:px-10"
    >
      Desarrollado por{" "}
      <a
        href="https://marcagrowth.com"
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        MarCa Growth
      </a>
    </footer>
  );
}
