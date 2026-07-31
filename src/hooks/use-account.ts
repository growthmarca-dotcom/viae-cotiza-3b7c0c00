import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "agent" | "provider" | "operations";
export type AccountStatus = "pending" | "approved" | "rejected" | "suspended";

export type Account = {
  userId: string | null;
  status: AccountStatus | null;
  roles: AppRole[];
  fullName: string | null;
  agencyName: string | null;
};

async function fetchAccount(): Promise<Account> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { userId: null, status: null, roles: [], fullName: null, agencyName: null };

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("status, full_name, agency_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return {
    userId: user.id,
    status: (profile?.status as AccountStatus | undefined) ?? null,
    roles: (roles ?? []).map((r) => r.role as AppRole),
    fullName: profile?.full_name ?? null,
    agencyName: profile?.agency_name ?? null,
  };
}

export function useAccount() {
  const query = useQuery({ queryKey: ["account"], queryFn: fetchAccount, staleTime: 30_000 });
  const account = query.data;
  return {
    ...query,
    account,
    isAdmin: account?.roles.includes("admin") ?? false,
    /** Central operativa: administradores y usuarios con rol Operaciones. */
    isOperations:
      (account?.roles.includes("admin") || account?.roles.includes("operations")) ?? false,
    isApproved: account?.status === "approved" || (account?.roles.includes("admin") ?? false),
  };
}
