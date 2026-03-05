import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_GROUP_ID = "00000000-0000-0000-0000-000000000001";

export function useGroupId() {
  const { user } = useAuth();

  const { data: groupId, isLoading } = useQuery({
    queryKey: ["user-group-id", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.group_id ?? DEFAULT_GROUP_ID;
    },
    enabled: !!user,
  });

  return { groupId: groupId ?? DEFAULT_GROUP_ID, isLoading };
}
