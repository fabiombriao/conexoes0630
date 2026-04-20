import React, { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, ClipboardList, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupId } from "@/hooks/useGroupId";

const AdminPendingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { groupId, isLoading: groupLoading } = useGroupId();
  const hasToastedSessionsError = useRef(false);

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
  const {
    data: pendingSessions,
    isLoading: loadingSessions,
    error: pendingSessionsError,
  } = useQuery({
    queryKey: ["pending-attendance-sessions", groupId],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from("attendance_sessions")
        .select("id, session_date, created_by, created_at, status")
        .eq("group_id", groupId)
        .eq("status", "pending_approval" as any)
        .eq("is_test", false)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const uniqueCreatorIds = Array.from(
        new Set((sessions ?? []).map((s: any) => s.created_by).filter(Boolean)),
      );

      let creatorNameById = new Map<string, string>();
      if (uniqueCreatorIds.length > 0) {
        // Best-effort: if RLS blocks profiles, we still show the list without creator names.
        const { data: creators, error: creatorsError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", uniqueCreatorIds);
        if (!creatorsError && creators) {
          creatorNameById = new Map(
            creators.map((p: any) => [p.id, p.full_name || "Admin"]),
          );
        }
      }

      return (sessions ?? []).map((s: any) => ({
        ...s,
        created_by_name: creatorNameById.get(s.created_by) || "Admin",
      }));
    },
    enabled: !!user && !groupLoading,
  });

  useEffect(() => {
    if (!pendingSessionsError) {
      hasToastedSessionsError.current = false;
      return;
    }
    if (hasToastedSessionsError.current) return;
    hasToastedSessionsError.current = true;
    toast.error((pendingSessionsError as any).message || "Erro ao carregar listas de presença pendentes");
  }, [pendingSessionsError]);

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
        .update({
          status: "approved" as any,
          approved_at: new Date().toISOString(),
          approved_by: user!.id,
        })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-attendance-sessions", groupId] });
      queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-summary", groupId] });
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
      queryClient.invalidateQueries({ queryKey: ["pending-attendance-sessions", groupId] });
      queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-summary", groupId] });
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
        {pendingSessionsError ? (
          <p className="text-sm text-destructive">
            Erro ao carregar listas pendentes: {(pendingSessionsError as any).message || "Tente novamente"}
          </p>
        ) : loadingSessions ? (
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
                    Enviada por {s.created_by_name || "Admin"}
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
