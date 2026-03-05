import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
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

const PRESETS = [
  { label: "Esta semana", days: 7 },
  { label: "Este mês", days: 30 },
  { label: "Mês anterior", days: 60 },
];

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const { isSuperAdmin, can } = usePermissions();
  const isFullReport = isSuperAdmin || can("view_reports");

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const { data: contributions, isLoading } = useQuery({
    queryKey: ["report-contributions", user?.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*")
        .eq("user_id", user!.id)
        .in("type", ["one_to_one", "referral", "onf"])
        .gte("contribution_date", startDate)
        .lte("contribution_date", endDate)
        .order("contribution_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const totalTT = contributions?.filter((c) => c.type === "one_to_one").length ?? 0;
  const totalIndications = contributions?.filter((c) => c.type === "referral").length ?? 0;
  const totalDeals = contributions?.filter((c) => c.type === "onf").length ?? 0;
  const totalDealValue = contributions?.filter((c) => c.type === "onf").reduce((s, c) => s + (Number(c.business_value) || 0), 0) ?? 0;

  const weeklyData = React.useMemo(() => {
    if (!contributions) return [];
    const weeks: Record<string, number> = {};
    contributions.filter((c) => c.type === "referral").forEach((c) => {
      const d = new Date(c.contribution_date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      weeks[key] = (weeks[key] || 0) + 1;
    });
    return Object.entries(weeks).slice(-12).map(([week, count]) => ({ week, indicações: count }));
  }, [contributions]);

  const metrics = [
    { label: "Téte a téte", value: totalTT },
    { label: "Indicações", value: totalIndications },
    { label: "Negócios Fechados", value: totalDeals },
    { label: "Total R$", value: `R$ ${totalDealValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
  ];

  const exportCSV = () => {
    if (!contributions) return;
    const header = "Data,Tipo,Detalhes,Valor\n";
    const rows = contributions.map((c) => {
      const type = c.type === "one_to_one" ? "Téte a téte" : c.type === "referral" ? "Indicação" : "Negócio Fechado";
      const detail = c.contact_name || c.meeting_location || "";
      const val = c.business_value || "";
      return `${c.contribution_date},${type},${detail},${val}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contribuicoes-tin.csv";
    a.click();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold">Relatórios TIN</h1>
        <Button variant="outline" onClick={exportCSV} className="border-border">
          Exportar CSV
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => setPreset(p.days)} className="border-border">
            {p.label}
          </Button>
        ))}
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-muted border-border w-auto" />
        <span className="text-muted-foreground">→</span>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-muted border-border w-auto" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <Card key={m.label} className="bg-card border-border card-hover-border">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{m.label}</p>
                  <p className="text-2xl font-display font-bold mt-1">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-lg">Indicações por Semana</CardTitle></CardHeader>
            <CardContent>
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" />
                    <XAxis dataKey="week" stroke="hsl(0,0%,60%)" fontSize={12} />
                    <YAxis stroke="hsl(0,0%,60%)" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(0,0%,13%)", border: "1px solid hsl(0,0%,18%)", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="indicações" stroke="hsl(24,100%,50%)" strokeWidth={2} dot={{ fill: "hsl(24,100%,50%)" }} />
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
