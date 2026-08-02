import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  communicationStatusClasses,
  communicationStatusLabel,
  communicationTypeLabel,
  formatEventDate,
  type CommunicationEvent,
} from "@/lib/communication";

/**
 * Comunicaciones del expediente (v1.9.5.4).
 *
 * Solo lectura sobre `communication_events`: la reserva y sus servicios de
 * transporte. NO se implementa envío real en esta versión.
 */
export function BookingCommunicationsPanel({ bookingId }: { bookingId: string }) {
  const [events, setEvents] = useState<CommunicationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [{ data: transport }, { data: services }] = await Promise.all([
          supabase.from("transport_services").select("id").eq("booking_id", bookingId),
          supabase.from("booking_services").select("id").eq("booking_id", bookingId),
        ]);
        const ids = [
          bookingId,
          ...(transport ?? []).map((t) => t.id),
          ...(services ?? []).map((s) => s.id),
        ];
        const { data, error } = await supabase
          .from("communication_events")
          .select("*")
          .in("entity_id", ids)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setEvents((data ?? []) as CommunicationEvent[]);
      } catch (err) {
        if (active) {
          toast.error(err instanceof Error ? err.message : "No se pudieron cargar las comunicaciones");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingId]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <MessageSquare className="h-5 w-5 text-gold" /> Comunicaciones
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Registro de mensajes operativos de esta reserva. En esta versión no se realiza envío real.
      </p>

      {loading ? (
        <div className="flex items-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando comunicaciones...
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Destinatario</th>
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2">Lectura</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                    Sin comunicaciones registradas.
                  </td>
                </tr>
              )}
              {events.map((e) => {
                const readAt = (e.data as Record<string, unknown> | null)?.["read_at"];
                return (
                  <tr key={e.id} className="border-t border-border/60">
                    <td className="py-2 pr-4 font-medium">{communicationTypeLabel(e.event_type)}</td>
                    <td className="py-2 pr-4">{e.recipient_name ?? e.phone ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {formatEventDate(e.sent_at ?? e.created_at)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${communicationStatusClasses(e.status)}`}
                      >
                        {communicationStatusLabel(e.status)}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {readAt ? `Leído · ${formatEventDate(String(readAt))}` : "No leído"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
