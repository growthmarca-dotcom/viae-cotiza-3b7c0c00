import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Mecanismo de recuperación: si el sistema quedara sin ningún administrador,
 * cualquier usuario autenticado puede reclamar el rol de Administrador.
 * La función de base de datos rechaza la operación si ya existe un administrador.
 */
export function AdminRecovery() {
  const queryClient = useQueryClient();
  const [working, setWorking] = useState(false);

  const { data: adminsExist, isLoading } = useQuery({
    queryKey: ["admins-exist"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admins_exist");
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 30_000,
  });

  if (isLoading || adminsExist !== false) return null;

  async function claim() {
    setWorking(true);
    try {
      const { error } = await supabase.rpc("claim_admin_if_none");
      if (error) throw error;
      toast.success("Acceso de administrador recuperado");
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo recuperar el acceso");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/5 p-6 text-left">
      <div className="flex items-center gap-2 font-display text-lg font-semibold">
        <ShieldPlus className="h-5 w-5 text-gold" /> Recuperar administración
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        El sistema no tiene ningún administrador activo. Puedes tomar el rol de Administrador
        para restablecer la gestión de cuentas. Esta acción queda registrada en el log de permisos.
      </p>
      <Button className="mt-4" onClick={claim} disabled={working}>
        {working ? "Recuperando..." : "Tomar rol de Administrador"}
      </Button>
    </div>
  );
}
