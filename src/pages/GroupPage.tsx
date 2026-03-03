import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";

const GroupPage: React.FC = () => {
  const { user } = useAuth();

  const { data: members, isLoading } = useQuery({
    queryKey: ["group-members", user?.id],
    queryFn: async () => {
      const { data: membership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!membership?.group_id) return [];

      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, profiles(full_name, professional_title, company_name, business_category, avatar_url, vcr_score)")
        .eq("group_id", membership.group_id);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-display font-bold">Grupo</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !members || members.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 text-primary" />
            <p className="text-lg mb-1">Você ainda não pertence a um grupo</p>
            <p className="text-sm">Peça ao administrador para adicioná-lo a um grupo.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m: any) => (
            <Card key={m.user_id} className="bg-card border-border card-hover-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg ring-2 ring-primary/30">
                    {m.profiles?.full_name?.[0] || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.profiles?.full_name || "Membro"}</p>
                    <p className="text-sm text-muted-foreground truncate">{m.profiles?.professional_title}</p>
                    {m.profiles?.business_category && (
                      <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {m.profiles.business_category}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupPage;
