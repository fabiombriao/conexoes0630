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
  // New JSON keys (used by ManageAdminsPage)
  canControlAttendance?: boolean;
  canCreateEvents?: boolean;
  canViewReports?: boolean;
  canManageProfiles?: boolean;
  canSendAnnouncements?: boolean;
  canViewInvitations?: boolean;
}

export type UserRole = "superadmin" | "admin" | "member";

// Map new-style JSON keys to old-style permission names
const KEY_MAP: Record<string, keyof AdminPermissions> = {
  canControlAttendance: "attendance_control",
  canCreateEvents: "create_events",
  canViewReports: "view_reports",
  canManageProfiles: "manage_profiles",
  canSendAnnouncements: "send_announcements",
  canViewInvitations: "view_visitor_invitations",
};

function normalizePerms(raw: Record<string, unknown> | null): AdminPermissions {
  if (!raw) return {};
  const result: AdminPermissions = { ...raw } as AdminPermissions;
  // Merge new-style keys into old-style so `can()` works uniformly
  for (const [newKey, oldKey] of Object.entries(KEY_MAP)) {
    if (raw[newKey] === true) {
      (result as Record<string, unknown>)[oldKey] = true;
    }
  }
  return result;
}

export function usePermissions() {
  const { user } = useAuth();

  const {
    data: profile,
    isLoading: isProfileLoading,
  } = useQuery({
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

  const {
    data: roles,
    isLoading: isRolesLoading,
  } = useQuery({
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

  const adminPerms: AdminPermissions = normalizePerms(
    profile?.admin_permissions as Record<string, unknown> | null
  );

  const isPermissionsLoading = !!user && (isProfileLoading || isRolesLoading);
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
    isPermissionsLoading,
    isActive,
    accountStatus,
    can,
    adminPerms,
  };
}
