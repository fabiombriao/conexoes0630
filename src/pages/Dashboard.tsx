import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, ArrowUpRight, Flame, Handshake, Send, FileCheck, Trophy } from "lucide-react";
import { useGroupId } from "@/hooks/useGroupId";

type DashboardContributionType = "one_to_one" | "referral" | "onf";

type RecentActivityItem = {
  id: string;
  type: DashboardContributionType;
  contribution_date: string;
  contact_name: string | null;
  meeting_location: string | null;
  business_value: string | number | null;
  created_at: string;
};

const TYPE_ICONS: Record<DashboardContributionType, React.ReactNode> = {
  one_to_one: <Users className="h-4 w-4 text-secondary" />,
  referral: <Send className="h-4 w-4 text-primary" />,
  onf: <Handshake className="h-4 w-4 text-success" />,
};

const TYPE_LABELS: Record<DashboardContributionType, string> = {
  one_to_one: "Téte a téte",
  referral: "Recomendação",
  onf: "Negócio Fechado",
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { groupId } = useGroupId();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", user?.id, groupId],
    queryFn: async () => {
      const { data: contributions } = await supabase
        .from("contributions")
        .select("*")
        .eq("user_id", user!.id)
        .in("type", ["one_to_one", "referral", "onf"]);

      const indications = contributions?.filter((c) => c.type === "referral").length ?? 0;
      const deals = contributions?.filter((c) => c.type === "onf") ?? [];
      const deals_total = deals.reduce((sum, c) => sum + (Number(c.business_value) || 0), 0);
      const tete_a_tetes = contributions?.filter((c) => c.type === "one_to_one").length ?? 0;

      // Attendance streak from attendance_records + approved sessions
      const { data: approvedSessions } = await supabase
        .from("attendance_sessions")
        .select("id, session_date")
        .eq("group_id", groupId)
        .eq("status", "approved")
        .eq("is_test", false)
        .order("session_date", { ascending: false })
        .limit(52);

      let streak = 0;
      if (approvedSessions && approvedSessions.length > 0) {
        const sessionIds = approvedSessions.map((s) => s.id);
        const { data: records } = await supabase
          .from("attendance_records")
          .select("session_id, status")
          .eq("member_id", user!.id)
          .in("session_id", sessionIds);

        const recordMap = new Map(records?.map((r) => [r.session_id, r.status]) ?? []);

        for (const session of approvedSessions) {
          const status = recordMap.get(session.id);
          if (status === "present" || status === "substituted") {
            streak++;
          } else {
            break;
          }
        }
      }

      return { indications, deals_total, tete_a_tetes, streak };
    },
    enabled: !!user && !!groupId,
  });

  // Recent activity: last 10 contributions
  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("id, type, contribution_date, contact_name, meeting_location, business_value, created_at")
        .eq("user_id", user!.id)
        .in("type", ["one_to_one", "referral", "onf"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Monthly ranking score for current user
  const { data: monthlyScore } = useQuery({
    queryKey: ["monthly-ranking-user", user?.id, groupId],
    queryFn: async () => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("monthly_rankings")
        .select("total_points")
        .eq("group_id", groupId!)
        .eq("member_id", user!.id)
        .eq("month", currentMonth)
        .maybeSingle();
      if (error) throw error;
      return data?.total_points ?? 0;
    },
    enabled: !!user && !!groupId,
    staleTime: 5 * 60_000,
  });

  const firstName = profile?.full_name?.split(" ")[0] || "Membro";

  const statCards = [
    { label: "Negócios Fechados (R$)", value: `R$ ${(stats?.deals_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-success" },
    { label: "Téte a téte", value: stats?.tete_a_tetes ?? 0, icon: Users, color: "text-secondary" },
    { label: "Recomendações", value: stats?.indications ?? 0, icon: ArrowUpRight, color: "text-primary" },
    { label: "Presença", value: `${stats?.streak ?? 0} sem.`, icon: Flame, color: "text-primary" },
    { label: "Pontuação do Mês", value: `${monthlyScore ?? 0} pts`, icon: Trophy, color: "text-warning" },
  ];

  const getActivityDescription = (item: RecentActivityItem) => {
    if (item.type === "one_to_one") return item.meeting_location ? `em ${item.meeting_location}` : "";
    if (item.type === "referral") return item.contact_name ? `para ${item.contact_name}` : "";
    if (item.type === "onf") return item.business_value ? `R$ ${Number(item.business_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
    return "";
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">
          O despertador do sucesso toca às 06:30.
        </h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="card-hover-border bg-card border-border">
            <CardContent className="p-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {stat.label}
                    </span>
                  </div>
                  <p className="text-2xl font-display font-bold">{stat.value}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <h2 className="font-display font-bold text-lg mb-4">Atividade Recente</h2>
          {!recentActivity || recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma atividade recente.</p>
              <p className="text-sm mt-1">Comece registrando uma contribuição!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-b-0">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {TYPE_ICONS[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{TYPE_LABELS[item.type] || item.type}</p>
                    <p className="text-xs text-muted-foreground truncate">{getActivityDescription(item)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
