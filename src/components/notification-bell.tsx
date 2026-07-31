import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatNotificationDate,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  currentUserId,
  subscribeToMyNotifications,
  notificationKindClasses,
  notificationKindLabel,
  unreadCount,
  type Notification,
} from "@/lib/notifications";

/**
 * Centro de notificaciones global (v1.4).
 * Muestra los avisos del usuario actual: asignaciones, cambios de estado,
 * cambios de horario y cobros informados. La lectura queda auditada.
 */
export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listMyNotifications(40));
    } catch {
      // silencioso: la campana nunca debe interrumpir la navegación
    } finally {
      setLoading(false);
    }
  }, []);

  // v1.5: entrega en tiempo real (con refresco de respaldo espaciado).
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    load();
    currentUserId().then((uid) => {
      if (!uid || cancelled) return;
      unsubscribe = subscribeToMyNotifications(uid, load);
    });
    const timer = setInterval(load, 300000);
    return () => {
      cancelled = true;
      unsubscribe?.();
      clearInterval(timer);
    };
  }, [load]);

  const unread = unreadCount(items);

  async function readAll() {
    const ids = items.filter((n) => n.read_at == null).map((n) => n.id);
    if (ids.length === 0) return;
    try {
      await markAllNotificationsRead(ids);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo marcar como leído");
    }
  }

  async function readOne(id: string) {
    try {
      await markNotificationRead(id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo marcar como leído");
    }
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ""}`}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-gold-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold">Notificaciones</p>
          <Button variant="ghost" size="sm" disabled={unread === 0} onClick={readAll}>
            Marcar todo leído
          </Button>
        </div>
        <ScrollArea className="max-h-[380px]">
          {loading && items.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando avisos...
            </p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No tenés notificaciones.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 text-sm ${n.read_at == null ? "bg-secondary/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${notificationKindClasses(n.kind)}`}
                    >
                      {notificationKindLabel(n.kind)}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatNotificationDate(n.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                  {n.read_at == null && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto p-0 text-xs"
                      onClick={() => readOne(n.id)}
                    >
                      Marcar como leído
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
