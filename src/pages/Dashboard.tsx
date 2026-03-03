import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Users,
  BookOpen,
  Flame,
} from "lucide-react";

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

      const refs_given = contributions?.filter(c => c.type === "referral").length ?? 0;
      const onfs = contributions?.filter(c => c.type === "onf") ?? [];
      const onf_total = onfs.reduce((sum, c) => sum + (Number(c.business_value) || 0), 0);
      const one_to_ones = contributions?.filter(c => c.type === "one_to_one").length ?? 0;
      const uegs = contributions?.filter(c => c.type === "ueg").reduce((sum, c) => sum + (c.ueg_points || 0), 0) ?? 0;
      const attendances = contributions?.filter(c => c.type === "attendance" && c.attendance_status === "present").length ?? 0;

      return { refs_given, onf_total, one_to_ones, uegs, attendances };
    },
    enabled: !!user,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const getDayName = () => {
    return new Date().toLocaleDateString("pt-BR", { weekday: "long" });
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Membro";

  const statCards = [
    { label: "Referências Dadas", value: stats?.refs_given ?? 0, icon: ArrowUpRight, color: "text-primary" },
    { label: "ONFs (R$)", value: `R$ ${(stats?.onf_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-success" },
    { label: "Um-a-Uns", value: stats?.one_to_ones ?? 0, icon: Users, color: "text-secondary" },
    { label: "UEGs", value: stats?.uegs ?? 0, icon: BookOpen, color: "text-accent" },
    { label: "Presenças", value: stats?.attendances ?? 0, icon: Flame, color: "text-primary" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">
          {getGreeting()}, {firstName} ☀️
        </h1>
        <p className="text-muted-foreground mt-1">
          É {getDayName()}, 06:30. Vamos gerar negócios?
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
