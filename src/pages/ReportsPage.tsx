import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const ReportsPage: React.FC = () => {
  const { user } = useAuth();

  const { data: contributions, isLoading } = useQuery({
    queryKey: ["all-contributions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*")
        .eq("user_id", user!.id)
        .order("contribution_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const totalRefs = contributions?.filter(c => c.type === "referral").length ?? 0;
  const totalOnf = contributions?.filter(c => c.type === "onf").reduce((s, c) => s + (Number(c.business_value) || 0), 0) ?? 0;
  const totalOneToOnes = contributions?.filter(c => c.type === "one_to_one").length ?? 0;
  const totalUegs = contributions?.filter(c => c.type === "ueg").reduce((s, c) => s + (c.ueg_points || 0), 0) ?? 0;
  const totalAttendance = contributions?.filter(c => c.type === "attendance").length ?? 0;
  const presentCount = contributions?.filter(c => c.type === "attendance" && c.attendance_status === "present").length ?? 0;
  const attendancePercent = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  // Weekly referrals for line chart
  const weeklyData = React.useMemo(() => {
    if (!contributions) return [];
    const weeks: Record<string, number> = {};
    contributions.filter(c => c.type === "referral").forEach(c => {
      const d = new Date(c.contribution_date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      weeks[key] = (weeks[key] || 0) + 1;
    });
    return Object.entries(weeks).slice(-12).map(([week, count]) => ({ week, referências: count }));
  }, [contributions]);

  const metrics = [
    { label: "Referências", value: totalRefs },
    { label: "ONF Total", value: `R$ ${totalOnf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
    { label: "Um-a-Uns", value: totalOneToOnes },
    { label: "UEGs", value: totalUegs },
    { label: "Presença", value: `${attendancePercent}%` },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-display font-bold">Relatórios</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {metrics.map(m => (
              <Card key={m.label} className="bg-card border-border card-hover-border">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{m.label}</p>
                  <p className="text-2xl font-display font-bold mt-1">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-lg">Referências por Semana</CardTitle></CardHeader>
            <CardContent>
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" />
                    <XAxis dataKey="week" stroke="hsl(0,0%,60%)" fontSize={12} />
                    <YAxis stroke="hsl(0,0%,60%)" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(0,0%,13%)", border: "1px solid hsl(0,0%,18%)", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="referências" stroke="hsl(24,100%,50%)" strokeWidth={2} dot={{ fill: "hsl(24,100%,50%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem dados para exibir</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
