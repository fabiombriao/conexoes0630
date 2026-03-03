import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminPermissions {
  attendance_control?: boolean;
  create_events?: boolean;
  view_reports?: boolean;
  manage_profiles?: boolean;
  send_announcements?: boolean;
  view_visitor_invitations?: boolean;
}

export type UserRole = "superadmin" | "admin" | "member";

export function usePermissions() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-permissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("status, admin_permissions")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: roles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const roleList = roles?.map((r) => r.role) ?? [];
  const isSuperAdmin = roleList.includes("admin"); // 'admin' in DB = superadmin in UI
  const isGroupLeader = roleList.includes("group_leader"); // group_leader in DB = admin in UI
  const isMember = roleList.includes("member");

  const userRole: UserRole = isSuperAdmin
    ? "superadmin"
    : isGroupLeader
    ? "admin"
    : "member";

  const adminPerms: AdminPermissions =
    (profile?.admin_permissions as AdminPermissions) ?? {};

  const accountStatus = profile?.status ?? "pending";
  const isActive = accountStatus === "active";

  const can = (permission: keyof AdminPermissions): boolean => {
    if (isSuperAdmin) return true;
    if (isGroupLeader) return !!adminPerms[permission];
    return false;
  };

  return {
    userRole,
    isSuperAdmin,
    isAdmin: isGroupLeader,
    isMember,
    isActive,
    accountStatus,
    can,
    adminPerms,
  };
}
