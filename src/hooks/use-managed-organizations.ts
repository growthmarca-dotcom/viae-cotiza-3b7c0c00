import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Agencias donde el usuario actual es dueño o administrador activo. */
export function useManagedOrganizations() {
  return useQuery({
    queryKey: ["managed-organizations"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as { organization_id: string; name: string }[];
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, organizations(trade_name)")
        .eq("user_id", u.user.id)
        .eq("status", "active")
        .in("role", ["organization_owner", "organization_admin"]);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        organization_id: r.organization_id as string,
        name:
          ((r as unknown as { organizations: { trade_name: string | null } | null }).organizations
            ?.trade_name) ?? "Mi agencia",
      }));
    },
  });
}
