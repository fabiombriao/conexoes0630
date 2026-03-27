import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, RefreshCw, ClipboardList, FlaskConical, Users } from "lucide-react";
import { useGroupId } from "@/hooks/useGroupId";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type AttendanceStatus = "present" | "absent" | "substituted";

interface MemberAttendance {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  status: AttendanceStatus;
  substitute_name: string;
}

const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { groupId } = useGroupId();
  const queryClient = useQueryClient();
  const [isTest, setIsTest] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [isOpen, setIsOpen] = useState(false);
  const [attendanceList, setAttendanceList] = useState<MemberAttendance[]>([]);

  const { data: members } = useQuery({
    queryKey: ["group-members-attendance", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, profiles(full_name, avatar_url)")
        .eq("group_id", groupId);
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["attendance-sessions", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("*")
        .eq("group_id", groupId)
        .eq("is_test", false)
        .order("session_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  // Fetch attendance summary per member (approved sessions only)
  const { data: attendanceSummary } = useQuery({
    queryKey: ["attendance-summary", groupId],
    queryFn: async () => {
      // Get approved session IDs
      const { data: approvedSessions, error: sessErr } = await supabase
        .from("attendance_sessions")
        .select("id")
        .eq("group_id", groupId)
        .eq("status", "approved")
        .eq("is_test", false);
      if (sessErr) throw sessErr;
      if (!approvedSessions?.length) return [];

      const sessionIds = approvedSessions.map((s) => s.id);
      const { data: records, error: recErr } = await supabase
        .from("attendance_records")
        .select("member_id, status")
        .in("session_id", sessionIds);
      if (recErr) throw recErr;

      // Aggregate by member
      const map: Record<string, { present: number; absent: number }> = {};
      for (const r of records || []) {
        if (!map[r.member_id]) map[r.member_id] = { present: 0, absent: 0 };
        if (r.status === "present" || r.status === "substituted") {
          map[r.member_id].present++;
        } else {
          map[r.member_id].absent++;
        }
      }

      // Get profile names
      const memberIds = Object.keys(map);
      if (!memberIds.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", memberIds);

      return memberIds.map((id) => {
        const prof = profiles?.find((p) => p.id === id);
        return {
          id,
          full_name: prof?.full_name || "Membro",
          avatar_url: prof?.avatar_url,
          ...map[id],
        };
      }).sort((a, b) => b.present - a.present);
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (isTest) {
        toast.success("Chamada teste concluída! Nenhum dado foi salvo.");
        setIsOpen(false);
        setAttendanceList([]);
        return;
      }

      const { data: session, error: sessionError } = await supabase
        .from("attendance_sessions")
        .insert({
          session_date: sessionDate,
          created_by: user!.id,
          group_id: groupId,
          status: "pending_approval" as any,
          is_test: false,
        })
        .select()
        .single();
      if (sessionError) throw sessionError;

      const records = attendanceList.map((m) => ({
        session_id: session.id,
        member_id: m.user_id,
        status: m.status as any,
        substitute_name: m.status === "substituted" ? m.substitute_name : null,
      }));

      const { error: recError } = await supabase
        .from("attendance_records")
        .insert(records);
      if (recError) throw recError;
    },
    onSuccess: () => {
      if (!isTest) {
        queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
        toast.success("Lista de presença enviada para aprovação!");
      }
      setIsOpen(false);
      setAttendanceList([]);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar"),
  });

  const openAttendance = (test: boolean) => {
    setIsTest(test);
    setIsOpen(true);
    setAttendanceList(
      (members || []).map((m: any) => ({
        user_id: m.user_id,
        full_name: m.profiles?.full_name || "Membro",
        avatar_url: m.profiles?.avatar_url,
        status: "present" as AttendanceStatus,
        substitute_name: "",
      }))
    );
  };

  const updateStatus = (userId: string, status: AttendanceStatus) => {
    setAttendanceList((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, status } : m))
    );
  };

  const updateSubstitute = (userId: string, name: string) => {
    setAttendanceList((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, substitute_name: name } : m))
    );
  };

  const statusLabel: Record<string, string> = {
    pending_approval: "Aguardando aprovação",
    approved: "Aprovada",
    rejected: "Rejeitada",
  };

  if (isOpen) {
    return (
      <div className="space-y-4 max-w-3xl">
        {isTest && (
          <div className="bg-warning/10 border border-warning text-warning rounded-lg p-3 text-center text-sm font-medium">
            ⚠️ MODO TESTE — Nenhum dado será salvo
          </div>
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">
            {isTest ? "🧪 Chamada Teste" : "📋 Chamada"} — {new Date(sessionDate + "T12:00:00").toLocaleDateString("pt-BR")}
          </h1>
          <Button variant="ghost" onClick={() => { setIsOpen(false); setAttendanceList([]); }}>
            Cancelar
          </Button>
        </div>

        <div className="space-y-2">
          {attendanceList.map((m) => (
            <Card key={m.user_id} className="bg-card border-border">
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold ring-2 ring-primary/30 shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    m.full_name[0]
                  )}
                </div>
                <span className="font-medium flex-1 min-w-0 truncate">{m.full_name}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant={m.status === "present" ? "default" : "outline"} onClick={() => updateStatus(m.user_id, "present")} className="border-border text-xs">
                    <Check className="h-3 w-3 mr-1" /> Presente
                  </Button>
                  <Button size="sm" variant={m.status === "absent" ? "destructive" : "outline"} onClick={() => updateStatus(m.user_id, "absent")} className="border-border text-xs">
                    <X className="h-3 w-3 mr-1" /> Ausente
                  </Button>
                  <Button size="sm" variant={m.status === "substituted" ? "secondary" : "outline"} onClick={() => updateStatus(m.user_id, "substituted")} className="border-border text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" /> Substituído
                  </Button>
                </div>
                {m.status === "substituted" && (
                  <Input placeholder="Nome do substituto" value={m.substitute_name} onChange={(e) => updateSubstitute(m.user_id, e.target.value)} className="bg-muted border-border w-full mt-1 h-9 text-sm" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className={`w-full font-bold uppercase tracking-wider ${isTest ? "bg-warning text-warning-foreground hover:bg-warning/90" : ""}`}>
          {submitMutation.isPending ? "Enviando..." : isTest ? "Finalizar Chamada Teste" : "Finalizar e Enviar para Aprovação"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-display font-bold">Controle de Presença</h1>

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-2">
          <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="bg-muted border-border" />
        </div>
        <Button onClick={() => openAttendance(false)} className="font-bold uppercase tracking-wider">
          <ClipboardList className="h-4 w-4 mr-2" /> Abrir Chamada
        </Button>
        <Button variant="outline" onClick={() => openAttendance(true)} className="border-warning text-warning hover:bg-warning/10">
          <FlaskConical className="h-4 w-4 mr-2" /> 🧪 Chamada Teste
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="font-display font-bold text-lg">Chamadas Enviadas</h2>
        {sessionsLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : !sessions || sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma chamada registrada</p>
        ) : (
          sessions.map((s: any) => (
            <Card key={s.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    📋 Lista de Presença — {new Date(s.session_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">{statusLabel[s.status] || s.status}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${s.status === "approved" ? "bg-success/10 text-success" : s.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                  {statusLabel[s.status] || s.status}
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AttendancePage;
