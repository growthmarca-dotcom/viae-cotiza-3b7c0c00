import type { ReactNode } from "react";
import { Clock, Loader2, ShieldAlert } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { AdminRecovery } from "@/components/admin-recovery";

/**
 * Bloquea el acceso a la aplicación hasta que un administrador apruebe la cuenta.
 * El registro es libre, pero la cuenta no opera hasta ser aprobada.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { isLoading, account, isApproved } = useAccount();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verificando tu cuenta...
      </div>
    );
  }

  if (!isApproved) {
    const rejected = account?.status === "rejected";
    const suspended = account?.status === "suspended";
    const title = rejected
      ? "Acceso no autorizado"
      : suspended
        ? "Cuenta suspendida"
        : "Cuenta pendiente de aprobación";
    const message = rejected
      ? "Un administrador no autorizó el acceso de esta cuenta. Contacta al administrador de ViaE Sales Hub."
      : suspended
        ? "Tu cuenta fue suspendida temporalmente. Contacta al administrador de ViaE Sales Hub para reactivarla."
        : "Tu registro fue recibido. Un administrador debe aprobar tu cuenta antes de que puedas operar en la plataforma.";
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
          {rejected || suspended ? <ShieldAlert className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <AdminRecovery />
      </div>
    );
  }

  return <>{children}</>;
}
