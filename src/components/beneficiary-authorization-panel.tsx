import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccount } from "@/hooks/use-account";
import {
  authorizeBeneficiary,
  beneficiaryState,
  beneficiaryStateClasses,
  beneficiaryStateLabel,
  getBeneficiaryAuthorization,
  listBeneficiaryAuthorizationHistory,
  revokeBeneficiary,
  type BeneficiaryAuthorization,
  type BeneficiaryAuthorizationHistory,
  type BeneficiaryType,
} from "@/lib/beneficiaryAuthorizations";

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Panel de autorización de beneficiario de comisiones.
 *
 * Reutilizable para agentes/personas y organizaciones. La autorización no
 * interviene en el cálculo (motor de acuerdos) y no otorga permisos de
 * visualización económica: sólo habilita el cobro de comisiones liquidadas.
 */
export function BeneficiaryAuthorizationPanel({
  beneficiaryType,
  beneficiaryId,
  title = "Beneficiario de comisiones",
  showHistory = true,
}: {
  beneficiaryType: BeneficiaryType;
  beneficiaryId: string;
  title?: string;
  showHistory?: boolean;
}) {
  const { isAdmin } = useAccount();
  const [auth, setAuth] = useState<BeneficiaryAuthorization | null>(null);
  const [history, setHistory] = useState<BeneficiaryAuthorizationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<null | "authorize" | "revoke">(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, h] = await Promise.all([
        getBeneficiaryAuthorization(beneficiaryType, beneficiaryId),
        showHistory
          ? listBeneficiaryAuthorizationHistory(beneficiaryType, beneficiaryId)
          : Promise.resolve([]),
      ]);
      setAuth(a);
      setHistory(h);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo cargar la autorización de beneficiario",
      );
    } finally {
      setLoading(false);
    }
  }, [beneficiaryType, beneficiaryId, showHistory]);

  useEffect(() => {
    void load();
  }, [load]);

  const state = beneficiaryState(auth);

  async function submit() {
    setSaving(true);
    try {
      if (dialog === "authorize") {
        await authorizeBeneficiary(beneficiaryType, beneficiaryId, reason, notes);
        toast.success("Beneficiario autorizado");
      } else {
        await revokeBeneficiary(beneficiaryType, beneficiaryId, reason);
        toast.success("Autorización revocada");
      }
      setDialog(null);
      setReason("");
      setNotes("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar la operación");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Habilita el cobro de comisiones liquidadas. No define el importe: el cálculo proviene
            exclusivamente de los acuerdos comerciales y sus reglas.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${beneficiaryStateClasses(state)}`}
        >
          {beneficiaryStateLabel(state)}
        </span>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Autorizado el</p>
              <p className="text-sm">{fmt(auth?.authorized_at)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Autorizado por</p>
              <p className="text-sm">{auth?.authorized_by ? "Administración" : "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Motivo</p>
              <p className="text-sm">{auth?.reason || "—"}</p>
            </div>
            {state === "revoked" && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Revocado el</p>
                <p className="text-sm">{fmt(auth?.revoked_at)}</p>
              </div>
            )}
            {auth?.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Observaciones
                </p>
                <p className="text-sm">{auth.notes}</p>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="mt-4 flex flex-wrap gap-2">
              {state === "authorized" ? (
                <Button variant="outline" onClick={() => setDialog("revoke")}>
                  <ShieldOff className="mr-2 h-4 w-4" /> Revocar autorización
                </Button>
              ) : (
                <Button onClick={() => setDialog("authorize")}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Autorizar como beneficiario
                </Button>
              )}
            </div>
          )}

          {showHistory && history.length > 0 && (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Historial</p>
              <ul className="mt-2 space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="font-medium">
                      {h.action === "authorized" ? "Autorización" : "Revocación"}
                    </span>{" "}
                    <span className="text-muted-foreground">· {fmt(h.created_at)}</span>
                    {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Dialog open={dialog != null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "revoke" ? "Revocar autorización" : "Autorizar como beneficiario"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "revoke"
                ? "La autorización queda revocada y el historial se conserva. El beneficiario no entrará a nuevas liquidaciones. Las liquidaciones existentes no se modifican."
                : "El beneficiario podrá entrar al circuito de nuevas liquidaciones. No cambia el cálculo ni los importes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo {dialog === "revoke" && <span className="text-destructive">*</span>}</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  dialog === "revoke" ? "Ej.: cese del acuerdo comercial" : "Ej.: acuerdo firmado"
                }
              />
            </div>
            {dialog === "authorize" && (
              <div>
                <Label>Observaciones</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={saving || (dialog === "revoke" && !reason.trim())}
              variant={dialog === "revoke" ? "destructive" : "default"}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog === "revoke" ? "Revocar" : "Autorizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
