import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Lock } from "lucide-react";

const RankingPage: React.FC = () => {
  const { user } = useAuth();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const isCurrentMonth = selectedMonth === currentMonth;
  const dayOfMonth = now.getDate();
  const isWeek4 = isCurrentMonth && dayOfMonth >= 22;

  const { data: membership } = useQuery({
    queryKey: ["group-membership-ranking", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: rankings, isLoading } = useQuery({
    queryKey: ["monthly-rankings", selectedMonth, membership?.group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_rankings")
        .select("*, profiles(full_name, avatar_url)")
        .eq("group_id", membership!.group_id)
        .eq("month", selectedMonth)
        .order("total_points", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.group_id,
  });

  // Build month options (last 12 months)
  const monthOptions: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Ranking do Mês
        </h1>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="h-10 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

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
      ) : !rankings || rankings.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-primary" />
            <p>Nenhum ranking disponível para este mês</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rankings.map((r: any, i: number) => (
            <Card key={r.id} className="bg-card border-border card-hover-border">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-display font-bold text-lg shrink-0 ${i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold ring-2 ring-primary/30 shrink-0">
                  {r.profiles?.avatar_url ? (
                    <img src={r.profiles.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    r.profiles?.full_name?.[0] || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.profiles?.full_name}</p>
                </div>
                <div className="font-display font-bold text-xl text-primary shrink-0">
                  {isWeek4 ? <Lock className="h-5 w-5 text-muted-foreground" /> : `${r.total_points} pts`}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RankingPage;
