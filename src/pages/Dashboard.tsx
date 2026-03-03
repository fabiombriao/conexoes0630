import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, ArrowUpRight, Flame } from "lucide-react";

const Dashboard: React.FC = () => {
  const { user } = useAuth();

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
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStr = weekAgo.toISOString().split("T")[0];

      const { data: contributions } = await supabase
        .from("contributions")
        .select("*")
        .eq("user_id", user!.id)
        .gte("contribution_date", weekStr);

      const indications = contributions?.filter((c) => c.type === "referral").length ?? 0;
      const deals = contributions?.filter((c) => c.type === "onf") ?? [];
      const deals_total = deals.reduce((sum, c) => sum + (Number(c.business_value) || 0), 0);
      const tete_a_tetes = contributions?.filter((c) => c.type === "one_to_one").length ?? 0;

      // Simple attendance streak
      const { data: allAttendance } = await supabase
        .from("contributions")
        .select("contribution_date, attendance_status")
        .eq("user_id", user!.id)
        .eq("type", "attendance")
        .order("contribution_date", { ascending: false })
        .limit(52);

      let streak = 0;
      if (allAttendance) {
        for (const a of allAttendance) {
          if (a.attendance_status === "present" || a.attendance_status === "substituted") {
            streak++;
          } else break;
        }
      }

      return { indications, deals_total, tete_a_tetes, streak };
    },
    enabled: !!user,
  });

  const firstName = profile?.full_name?.split(" ")[0] || "Membro";

  const statCards = [
    { label: "Negócios Fechados (R$)", value: `R$ ${(stats?.deals_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-success" },
    { label: "Téte a téte", value: stats?.tete_a_tetes ?? 0, icon: Users, color: "text-secondary" },
    { label: "Indicações", value: stats?.indications ?? 0, icon: ArrowUpRight, color: "text-primary" },
    { label: "Presença", value: `${stats?.streak ?? 0} sem.`, icon: Flame, color: "text-primary" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">
          O despertador do sucesso toca às 06:30.
        </h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma atividade recente.</p>
            <p className="text-sm mt-1">Comece registrando uma contribuição!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
