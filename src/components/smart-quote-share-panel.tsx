import { useState } from "react";
import { Copy, Link2, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  revokeSmartQuoteShare,
  shareSmartQuote,
  smartQuotePublicUrl,
  type SmartQuoteListRow,
} from "@/lib/smartQuotes";

/**
 * v1.13 Fase 3.0 — Enlace público de la propuesta.
 * La vista pública se renderiza desde la Smart Quote (no desde `quotations`).
 */
export function SmartQuoteSharePanel({
  quote,
  editable,
  onChanged,
}: {
  quote: SmartQuoteListRow;
  editable: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const token = quote.share_token;
  const url = token ? smartQuotePublicUrl(token) : null;
  const expired =
    !!quote.share_expires_at && new Date(quote.share_expires_at) < new Date();
  const shareableStatus = !["draft", "rejected", "expired"].includes(quote.status);

  async function generate() {
    setBusy(true);
    try {
      await shareSmartQuote(quote.id, 30);
      toast.success("Enlace público listo");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el enlace");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await revokeSmartQuoteShare(quote.id);
      toast.success("Enlace revocado");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo revocar el enlace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Enlace para el cliente</h2>
      <p className="text-xs text-muted-foreground">
        Muestra destino, fechas, pasajeros, servicios y total en {quote.currency}. Nunca expone
        costos, márgenes, proveedores ni notas internas.
      </p>

      {url ? (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs">{url}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {expired
              ? "Enlace vencido: generá uno nuevo para reactivarlo."
              : quote.share_expires_at
                ? `Válido hasta el ${new Date(quote.share_expires_at).toLocaleDateString()}.`
                : "Sin vencimiento."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success("Enlace copiado");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                Abrir
              </a>
            </Button>
            {editable && (
              <>
                <Button size="sm" variant="outline" disabled={busy} onClick={generate}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Renovar 30 días
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={revoke}>
                  <ShieldOff className="mr-2 h-4 w-4" /> Revocar
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Todavía no compartiste esta propuesta.
          </p>
          <Button size="sm" className="w-full" disabled={!editable || busy} onClick={generate}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Generar enlace público
          </Button>
        </>
      )}

      {!shareableStatus && (
        <p className="text-xs text-muted-foreground">
          El cliente sólo puede abrir la propuesta cuando el estado es lista, enviada o aceptada.
        </p>
      )}
    </section>
  );
}
