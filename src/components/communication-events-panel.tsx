import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  communicationStatusClasses,
  communicationStatusLabel,
  communicationSummary,
  communicationTypeLabel,
  formatEventDate,
  listCommunicationEvents,
  type CommunicationEvent,
  type CommunicationEventStatus,
} from "@/lib/communication";

const STATUS_TABS: { value: CommunicationEventStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "sent", label: "Enviados" },
  { value: "error", label: "Con error" },
];

/**
 * Centro de comunicaciones (v1.5).
 * Cola de eventos preparada para WhatsApp: se registran y se auditan, pero
 * todavía no se envían. Sirve para verificar qué avisos se dispararían.
 */
export function CommunicationEventsPanel() {
  const [items, setItems] = useState<CommunicationEvent[]>([]);
  const [status, setStatus] = useState<CommunicationEventStatus | "all">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listCommunicationEvents({ status }, 50));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los eventos");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => communicationSummary(items), [items]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <MessageSquare className="h-4 w-4 text-gold" /> Centro de comunicaciones
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Eventos preparados para WhatsApp. En esta versión se registran y auditan, pero todavía
            no se envían.
          </p>
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setStatus(t.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                status === t.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {summary.total} eventos · {summary.pending} pendientes · {summary.sent} enviados ·{" "}
        {summary.error} con error
      </p>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando eventos...
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no hay eventos registrados.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {items.map((e) => (
            <li key={e.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{communicationTypeLabel(e.event_type)}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${communicationStatusClasses(e.status)}`}
                  >
                    {communicationStatusLabel(e.status)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatEventDate(e.created_at)}
                  </span>
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{e.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Destinatario: {e.recipient_name ?? "—"}
                {e.phone ? ` · ${e.phone}` : " · sin teléfono cargado"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
