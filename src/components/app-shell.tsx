import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  CalendarDays,
  ClipboardList,
  CarFront,
  Compass,
  Route as RouteIcon,


  Inbox,
  LayoutDashboard,

  FileText,
  PlusCircle,
  Users,
  Settings,
  ShieldCheck,
  UserRound,
  TicketCheck,
  Target,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { AppFooter } from "@/components/app-footer";
import { Building2, Handshake, UserSquare2, Wallet } from "lucide-react";
import { useDeveloperBranding } from "@/hooks/use-developer-branding";

import { cn } from "@/lib/utils";
import { useAccount } from "@/hooks/use-account";

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Consultas", icon: Inbox },
  { to: "/opportunities", label: "Pipeline comercial", icon: Target },
  // Smart Quotes queda fuera del menú principal en V1 (quotations es el cotizador
  // operativo). La ruta, las tablas y el código siguen intactos para fases futuras.
  // { to: "/smart-quotes", label: "Cotizaciones inteligentes", icon: Sparkles },
  { to: "/quotations/new", label: "Nueva cotización", icon: PlusCircle },
  { to: "/quotations", label: "Cotizaciones", icon: FileText },
  { to: "/bookings", label: "Reservas", icon: TicketCheck },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/persons", label: "Personas", icon: UserSquare2 },

  { to: "/agents", label: "Agentes", icon: UserRound },
  { to: "/commissions", label: "Mis comisiones", icon: Wallet },
  { to: "/my-settlements", label: "Mis liquidaciones", icon: Wallet },
  { to: "/resources", label: "Recursos", icon: Boxes },
  { to: "/transport", label: "Transporte", icon: RouteIcon },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/driver", label: "Panel conductor", icon: CarFront },

  { to: "/settings", label: "Configuración", icon: Settings },

] as const;

const adminNav = [
  { to: "/settlements", label: "Liquidaciones", icon: Wallet },
  { to: "/admin", label: "Administración", icon: ShieldCheck },
] as const;

/** Central operativa: sólo administración y usuarios con rol Operaciones. */
const operationsNav = [
  { to: "/operations", label: "Central operativa", icon: ClipboardList },
  { to: "/organizations", label: "Organizaciones", icon: Building2 },
  { to: "/providers", label: "Proveedores", icon: Building2 },
  { to: "/agreements", label: "Acuerdos comerciales", icon: Handshake },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { isAdmin, isOperations } = useAccount();
  const showDeveloperBranding = useDeveloperBranding();
  const nav = [
    ...baseNav,
    ...(isOperations ? operationsNav : []),
    ...(isAdmin ? adminNav : []),
  ];
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside data-print-hide className="hidden bg-sidebar text-sidebar-foreground md:flex md:flex-col">
          <div className="flex items-center gap-2 px-6 py-6">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gold text-gold-foreground">
              <Compass className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">
              ViaE <span className="text-gold">Sales Hub</span>
            </span>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {nav.map(({ to, label, icon: Icon }) => {
              const active =
                to === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === to || pathname.startsWith(to + "/");
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div data-print-hide className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gold text-gold-foreground">
              <Compass className="h-4 w-4" />
            </div>
            <span className="font-display font-semibold">ViaE</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <main className="min-w-0">
          <div
            data-print-hide
            className="hidden items-center justify-end border-b border-border bg-background/95 px-6 py-2 backdrop-blur md:flex"
          >
            <NotificationBell />
          </div>
          {/* Mobile bottom nav */}
          <div data-print-hide className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-2 py-2 backdrop-blur md:hidden">

            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
                activeProps={{ "data-status": "active" } as never}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>
          <div className="p-6 md:p-10">{children}</div>
          <AppFooter show={showDeveloperBranding} />
        </main>
      </div>
    </div>
  );
}
