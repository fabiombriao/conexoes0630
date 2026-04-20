import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, ClipboardList, UserCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupId } from "@/hooks/useGroupId";

type AttendanceRecordStatus = "present" | "absent" | "substituted";

type AttendancePreviewRow = {
  member_id: string;
  status: AttendanceRecordStatus;
  substitute_name: string | null;
  full_name: string;
  avatar_url?: string | null;
};

type PendingSessionRow = {
  id: string;
  session_date: string;
  created_by: string;
  created_at: string;
  status: string;
  created_by_name?: string;
};

function statusLabel(status: AttendanceRecordStatus) {
  if (status === "present") return "Presente";
  if (status === "absent") return "Ausente";
  return "Substituído";
}

function statusClass(status: AttendanceRecordStatus) {
  if (status === "present") return "text-success";
  if (status === "absent") return "text-destructive";
  return "text-secondary";
}

const PendingAttendanceSessionCard: React.FC<{
  session: PendingSessionRow;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}> = ({ session, onApprove, onReject, isApproving, isRejecting }) => {
  const [open, setOpen] = useState(false);

  const {
    data: previewRows,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ["attendance-session-preview", session.id],
    queryFn: async () => {
      const { data: records, error } = await supabase
        .from("attendance_records")
        .select("member_id, status, substitute_name")
        .eq("session_id", session.id);
      if (error) throw error;

      const memberIds = Array.from(new Set((records ?? []).map((r: any) => r.member_id).filter(Boolean)));
      let profileById = new Map<string, { full_name?: string | null; avatar_url?: string | null }>();
      if (memberIds.length > 0) {
        // Best-effort: if RLS blocks profiles, still show rows (with generic names).
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", memberIds);
        if (!profilesError && profiles) {
          profileById = new Map(profiles.map((p: any) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
        }
      }

      return (records ?? []).map((r: any) => {
        const p = profileById.get(r.member_id);
        return {
          member_id: r.member_id,
          status: r.status as AttendanceRecordStatus,
          substitute_name: r.substitute_name ?? null,
          full_name: p?.full_name || "Membro",
          avatar_url: p?.avatar_url ?? null,
        } satisfies AttendancePreviewRow;
      }).sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: open,
    staleTime: 60_000,
  });

  const counts = useMemo(() => {
    const rows = previewRows ?? [];
    let present = 0;
    let absent = 0;
    let substituted = 0;
    for (const r of rows) {
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else substituted++;
    }
    return { present, absent, substituted, total: rows.length };
  }, [previewRows]);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">
              📋 Lista de Presença — {new Date(session.session_date + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground">
              Enviada por {session.created_by_name || "Admin"}
              {open && !previewLoading && !previewError && counts.total > 0
                ? ` • ${counts.present} presente(s), ${counts.absent} ausente(s), ${counts.substituted} substituído(s)`
                : ""}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            <Button
              size="sm"
              variant="outline"
              className="border-border"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {open ? "Ocultar" : "Pré-visualizar"}
            </Button>
            <Button size="sm" onClick={onApprove} disabled={isApproving || isRejecting}>
              <Check className="h-4 w-4 mr-1" /> Aprovar
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject} disabled={isApproving || isRejecting}>
              <X className="h-4 w-4 mr-1" /> Rejeitar
            </Button>
          </div>
        </div>

        {open && (
          <div className="mt-4 pt-4 border-t border-border">
            {previewError ? (
              <p className="text-sm text-destructive">
                Erro ao carregar pré-visualização: {(previewError as any).message || "Tente novamente"}
              </p>
            ) : previewLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : !previewRows || previewRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro de presença encontrado nesta sessão.</p>
            ) : (
              <div className="space-y-2">
                {previewRows.map((r) => (
                  <div
                    key={r.member_id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold ring-2 ring-primary/30 shrink-0">
                        {r.avatar_url ? (
                          <img src={r.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          r.full_name?.[0] || "?"
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.full_name}</p>
                        {r.status === "substituted" && r.substitute_name ? (
                          <p className="text-xs text-muted-foreground truncate">Substituto: {r.substitute_name}</p>
                        ) : null}
                      </div>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${statusClass(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

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
      })) as PendingSessionRow[];
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
            <PendingAttendanceSessionCard
              key={s.id}
              session={s}
              onApprove={() => approveSessionMutation.mutate(s.id)}
              onReject={() => rejectSessionMutation.mutate(s.id)}
              isApproving={approveSessionMutation.isPending}
              isRejecting={rejectSessionMutation.isPending}
            />
          ))
        )}
      </section>
    </div>
  );
};

export default AdminPendingPage;
