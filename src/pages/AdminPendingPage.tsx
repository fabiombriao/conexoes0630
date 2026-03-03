import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, ClipboardList, UserCheck } from "lucide-react";

const AdminPendingPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Pending accounts
  const { data: pendingAccounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["pending-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .eq("status", "pending");
      if (error) throw error;
      return data;
    },
  });

  // Pending attendance sessions
  const { data: pendingSessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["pending-attendance-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("*, profiles:created_by(full_name)")
        .eq("status", "pending_approval" as any)
        .eq("is_test", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approveAccountMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-accounts"] });
      toast.success("Conta aprovada!");
    },
  });

  const rejectAccountMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "rejected" })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-accounts"] });
      toast.success("Conta rejeitada");
    },
  });

  const approveSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("attendance_sessions")
        .update({ status: "approved" as any, approved_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-attendance-sessions"] });
      toast.success("Lista de presença aprovada!");
    },
  });

  const rejectSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("attendance_sessions")
        .update({ status: "rejected" as any })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-attendance-sessions"] });
      toast.success("Lista rejeitada");
    },
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-display font-bold">Solicitações Pendentes</h1>

      {/* Pending Accounts */}
      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" /> Contas Pendentes
        </h2>
        {loadingAccounts ? (
          <Skeleton className="h-16" />
        ) : !pendingAccounts || pendingAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
        ) : (
          pendingAccounts.map((p: any) => (
            <Card key={p.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => approveAccountMutation.mutate(p.id)}>
                    <Check className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => rejectAccountMutation.mutate(p.id)}>
                    <X className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Pending Attendance */}
      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" /> Listas de Presença
        </h2>
        {loadingSessions ? (
          <Skeleton className="h-16" />
        ) : !pendingSessions || pendingSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma lista pendente</p>
        ) : (
          pendingSessions.map((s: any) => (
            <Card key={s.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    📋 Lista de Presença — {new Date(s.session_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enviada por {(s.profiles as any)?.full_name || "Admin"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => approveSessionMutation.mutate(s.id)}>
                    <Check className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => rejectSessionMutation.mutate(s.id)}>
                    <X className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
};

export default AdminPendingPage;
