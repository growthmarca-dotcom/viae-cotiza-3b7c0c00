import { useCallback, useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  formatTimelineDate,
  listBookingTimeline,
  timelineCategoryOf,
  timelineEventClasses,
  timelineEventDetail,
  timelineEventLabel,
  TIMELINE_CATEGORIES,
  type TimelineCategory,
  type TimelineEvent,
} from "@/lib/timeline";

/**
 * Timeline del Expediente 360° (v1.9.5.4).
 *
 * Solo lectura: la tabla es append-only y se alimenta desde triggers internos.
 * El filtro "visible al cliente" es únicamente visual: no expone nada al
 * exterior ni cambia permisos.
 */
export function BookingTimelinePanel({ bookingId }: { bookingId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [category, setCategory] = useState<TimelineCategory>("all");
  const [clientOnly, setClientOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await listBookingTimeline(bookingId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el expediente");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = events.filter((e) => {
    if (clientOnly && e.visibility !== "client") return false;
    if (category !== "all" && timelineCategoryOf(e.event_type) !== category) return false;
    return true;
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <History className="h-5 w-5 text-gold" /> Timeline del viaje
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cronología del expediente generada automáticamente. Registro histórico inalterable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="client-visible" checked={clientOnly} onCheckedChange={setClientOnly} />
          <Label htmlFor="client-visible" className="text-xs text-muted-foreground">
            Ver solo eventos visibles al cliente
          </Label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TIMELINE_CATEGORIES.map((c) => (
          <Button
            key={c.value}
            size="sm"
            variant={category === c.value ? "default" : "outline"}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando timeline...
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Sin eventos registrados para este filtro.
        </p>
      ) : (
        <ol className="mt-6 space-y-4">
          {filtered.map((e) => {
            const detail = timelineEventDetail(e);
            return (
              <li key={e.id} className="relative border-l border-border pl-6">
                <span className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-gold" />
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${timelineEventClasses(e.event_type)}`}
                  >
                    {timelineEventLabel(e.event_type)}
                  </span>
                  {e.visibility === "client" && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      Visible al cliente
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatTimelineDate(e.created_at)}
                  {e.actor_role ? ` · ${e.actor_role}` : ""}
                  {e.entity_type ? ` · ${e.entity_type}` : ""}
                </p>
                {detail && <p className="mt-1 text-sm">{detail}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
