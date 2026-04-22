import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, RefreshCw, Zap } from "lucide-react";
import { useGroupId } from "@/hooks/useGroupId";
import { usePermissions } from "@/hooks/usePermissions";
import { sortByText } from "@/lib/sortByText";

type RankedMember = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

const RankingRealtimePage: React.FC = () => {
  const { groupId } = useGroupId();
  const { isSuperAdmin, isPermissionsLoading } = usePermissions();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: groupMembers } = useQuery({
    queryKey: ["group-members-ranking-realtime", groupId],
    queryFn: async () => {
      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId!);
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const userIds = members.map((m) => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("status", "active")
        .not("full_name", "is", null)
        .neq("full_name", "")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      return sortByText(
        members
          .map((m) => {
            const profile = profiles?.find((p) => p.id === m.user_id);
            return {
              user_id: m.user_id,
              full_name: profile?.full_name,
              avatar_url: profile?.avatar_url || null,
            };
          })
          .filter((m) => m.full_name != null)
          .filter((m, i, arr) => arr.findIndex((x) => x.user_id === m.user_id) === i),
        (m) => m.full_name,
      );
    },
    enabled: !!groupId && isSuperAdmin,
    staleTime: 5 * 60_000,
  });

  const {
    data: rankings,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["monthly-rankings-realtime", currentMonth, groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_rankings")
        .select("*")
        .eq("group_id", groupId!)
        .eq("month", currentMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && isSuperAdmin,
    staleTime: 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });

  const mergedRankings = useMemo(() => {
    if (!groupMembers) return [];
    const rankingMap = new Map((rankings || []).map((r) => [r.member_id, r]));

    return groupMembers
      .map((m: RankedMember) => {
        const ranking = rankingMap.get(m.user_id);
        return {
          id: ranking?.id || `member-${m.user_id}`,
          member_id: m.user_id,
          total_points: ranking?.total_points ?? 0,
          position: ranking?.position ?? 0,
          tt_points: ranking?.tt_points ?? 0,
          indication_points: ranking?.indication_points ?? 0,
          deal_points: ranking?.deal_points ?? 0,
          presence_points: ranking?.presence_points ?? 0,
          profiles: {
            full_name: m.full_name,
            avatar_url: m.avatar_url,
          },
        };
      })
      .sort((a, b) => b.total_points - a.total_points)
      .map((r, i) => ({
        ...r,
        position: i + 1,
      }));
  }, [groupMembers, rankings]);

  if (isPermissionsLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" /> Ranking em Tempo Real
        </h1>
        <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualiza automaticamente
        </div>
      </div>

      <Card className="bg-primary/10 border-primary">
        <CardContent className="p-4 text-center">
          <p className="text-sm font-medium text-primary">
            <Trophy className="inline-block h-4 w-4 mr-1" />
            Exibição exclusiva para Super Admin, com pontos sempre visíveis.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : mergedRankings.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-primary" />
            <p>Nenhum membro encontrado neste grupo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {mergedRankings.map((r: any, i: number) => (
            <Card key={r.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-display font-bold text-lg shrink-0 ${i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {r.position ?? i + 1}
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold ring-2 ring-primary/30 shrink-0">
                  {r.profiles?.avatar_url ? (
                    <img src={r.profiles.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    (r.profiles?.full_name?.[0] || "?").toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.profiles?.full_name}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>T&T: {r.tt_points ?? 0}</span>
                    <span>Ind: {r.indication_points ?? 0}</span>
                    <span>Neg: {r.deal_points ?? 0}</span>
                    <span>Pres: {r.presence_points ?? 0}</span>
                  </div>
                </div>
                <div className="font-display font-bold text-xl text-primary shrink-0">
                  {`${r.total_points} pts`}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RankingRealtimePage;
