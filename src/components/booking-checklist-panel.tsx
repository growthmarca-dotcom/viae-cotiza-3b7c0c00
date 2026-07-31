import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-account";
import {
  CHECKLIST_STATUSES,
  checklistStatusClasses,
  checklistStatusLabel,
  computeChecklistProgress,
  listChecklistItems,
  updateChecklistItem,
  type ChecklistItem,
  type ChecklistStatus,
} from "@/lib/checklist";

/** Advertencias de tareas críticas pendientes. Informan, nunca bloquean. */
export function ChecklistWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="h-4 w-4" /> Tareas críticas pendientes
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

/** Barra compacta de avance operativo, reutilizable en listados. */
export function ChecklistProgressBar({
  done,
  total,
  percent,
  compact = false,
}: {
  done: number;
  total: number;
  percent: number;
  compact?: boolean;
}) {
  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{compact ? "Avance" : "Avance operativo"}</span>
        <span className="font-medium text-foreground">
          {percent} % · {done}/{total} tareas
        </span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  );
}

export function BookingChecklistPanel({ bookingId }: { bookingId: string }) {
  const { isOperations } = useAccount();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listChecklistItems(bookingId);
      setItems(rows);
      setNotes(Object.fromEntries(rows.map((r) => [r.id, r.notes ?? ""])));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el checklist");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const progress = computeChecklistProgress(items);

  async function apply(id: string, patch: { status?: ChecklistStatus; notes?: string | null }) {
    setBusyId(id);
    try {
      await updateChecklistItem(id, patch);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la tarea");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Checklist operativo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOperations
                ? "Control de preparación y ejecución del viaje."
                : "Avance de la preparación del viaje. Lo gestiona la central operativa."}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <ChecklistProgressBar
            done={progress.done}
            total={progress.total}
            percent={progress.percent}
          />
        </div>
      </div>

      <ChecklistWarnings warnings={progress.warnings} />

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando tareas…
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta reserva no tiene tareas cargadas.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {item.label}
                      {item.is_critical && (
                        <span className="ml-2 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          crítica
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.completed_at
                        ? `Completada el ${new Date(item.completed_at).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}`
                        : `Actualizada el ${new Date(item.updated_at).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}`}
                    </p>
                  </div>

                  {isOperations ? (
                    <div className="flex items-center gap-2">
                      {busyId === item.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Select
                        value={item.status}
                        onValueChange={(v) => apply(item.id, { status: v as ChecklistStatus })}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHECKLIST_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${checklistStatusClasses(item.status)}`}
                    >
                      {checklistStatusLabel(item.status)}
                    </span>
                  )}
                </div>

                {isOperations ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      className="max-w-md"
                      placeholder="Observaciones"
                      value={notes[item.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id || (notes[item.id] ?? "") === (item.notes ?? "")}
                      onClick={() => apply(item.id, { notes: notes[item.id]?.trim() || null })}
                    >
                      <Save className="mr-2 h-4 w-4" /> Guardar
                    </Button>
                  </div>
                ) : (
                  item.notes && <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
