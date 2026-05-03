import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Lock, History } from "lucide-react";
import { useGroupId } from "@/hooks/useGroupId";
import { sortByText } from "@/lib/sortByText";
import { getHistoricalRankingMonths } from "@/lib/rankingHistory";

const RankingPage: React.FC = () => {
  const { groupId } = useGroupId();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const dayOfMonth = now.getDate();
  const isWeek4 = dayOfMonth >= 22;

  const [historyMonth, setHistoryMonth] = useState("");

  // Fetch all group members
  const { data: groupMembers } = useQuery({
    queryKey: ["group-members-ranking", groupId],
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
    enabled: !!groupId,
    staleTime: 5 * 60_000,
  });

  // Fetch monthly rankings
  const { data: rankings, isLoading } = useQuery({
    queryKey: ["monthly-rankings", currentMonth, groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_rankings")
        .select("*")
        .eq("group_id", groupId!)
        .eq("month", currentMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Merge members with rankings (all members appear, even with 0 points)
  const mergedRankings = useMemo(() => {
    if (!groupMembers) return [];
    const rankingMap = new Map((rankings || []).map((r) => [r.member_id, r]));
    
    const merged = groupMembers.map((m: any) => {
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
    });

    // Sort by total_points descending
    return merged.sort((a, b) => b.total_points - a.total_points).map((r, i) => ({
      ...r,
      position: i + 1,
    }));
  }, [groupMembers, rankings]);

  const { data: historyMonthRows, isLoading: historyMonthsLoading } = useQuery({
    queryKey: ["monthly-rankings", "history-months", groupId, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_rankings")
        .select("month")
        .eq("group_id", groupId!)
        .lt("month", currentMonth)
        .order("month", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.month);
    },
    enabled: !!groupId,
    staleTime: 5 * 60_000,
  });

  const historyMonths = useMemo(
    () => getHistoricalRankingMonths(historyMonthRows ?? [], currentMonth),
    [historyMonthRows, currentMonth],
  );

  useEffect(() => {
    if (historyMonths.length === 0) {
      if (historyMonth !== "") {
        setHistoryMonth("");
      }
      return;
    }

    if (!historyMonth || !historyMonths.includes(historyMonth)) {
      setHistoryMonth(historyMonths[0]);
    }
  }, [historyMonth, historyMonths]);

  const { data: historyRankings, isLoading: historyLoading } = useQuery({
    queryKey: ["monthly-rankings", "history-rankings", historyMonth, groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_rankings")
        .select("*, profiles:member_id(full_name, avatar_url)")
        .eq("group_id", groupId)
        .eq("month", historyMonth)
        .order("total_points", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && !!historyMonth,
    staleTime: 60_000,
  });

  const formatMonth = (m: string) => {
    const d = new Date(m + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  const RankingList = ({ data, hidePoints }: { data: any[]; hidePoints: boolean }) => (
    <div className="space-y-2">
      {data.map((r: any, i: number) => (
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
              {!hidePoints && (
                <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>T&T: {r.tt_points ?? 0}</span>
                  <span>Ind: {r.indication_points ?? 0}</span>
                  <span>Neg: {r.deal_points ?? 0}</span>
                  <span>Pres: {r.presence_points ?? 0}</span>
                </div>
              )}
            </div>
            <div className="font-display font-bold text-xl text-primary shrink-0">
              {hidePoints ? <Lock className="h-5 w-5 text-muted-foreground" /> : `${r.total_points} pts`}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-display font-bold flex items-center gap-2">
        <Trophy className="h-6 w-6 text-primary" /> Ranking do Mês
      </h1>

      <Tabs defaultValue="current">
        <TabsList className="bg-muted">
          <TabsTrigger value="current">Atual</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4 mt-4">
          {isWeek4 && (
            <Card className="bg-primary/10 border-primary">
              <CardContent className="p-4 text-center">
                <p className="text-sm font-medium text-primary">
                  🔒 A pontuação foi ocultada para aumentar a emoção do fechamento do mês! 🔥
                </p>
              </CardContent>
            </Card>
          )}

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
            <RankingList data={mergedRankings} hidePoints={isWeek4} />
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          {historyMonthsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : historyMonths.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p>Nenhum histórico disponível ainda</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <select
                value={historyMonth}
                onChange={(e) => setHistoryMonth(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
              >
                <option value="">Selecione um mês</option>
                {historyMonths.map((m) => (
                  <option key={m} value={m}>{formatMonth(m)}</option>
                ))}
              </select>

              {historyMonth && (
                historyLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
                ) : !historyRankings || historyRankings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Sem dados para este mês</p>
                ) : (
                  <RankingList data={historyRankings} hidePoints={false} />
                )
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RankingPage;
