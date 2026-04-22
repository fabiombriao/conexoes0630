import React, { useMemo, useState } from "react";
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
import { sortByText } from "@/lib/sortByText";

type AttendanceStatus = "present" | "absent" | "substituted";
type GuestAttendanceStatus = "present" | "absent";
type AttendanceMode = "members" | "guests";

interface MemberAttendance {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  status: AttendanceStatus;
  substitute_name: string;
}

interface GuestAttendance {
  invitation_id: string;
  visitor_name: string;
  invited_by: string;
  invited_by_name: string;
  invited_by_avatar_url: string | null;
  status: GuestAttendanceStatus;
}

interface AttendanceSummaryItem {
  id: string;
  full_name: string;
  avatar_url: string | null;
  present: number;
  absent: number;
}

const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { groupId } = useGroupId();
  const queryClient = useQueryClient();
  const [isTest, setIsTest] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [isOpen, setIsOpen] = useState(false);
  const [openMode, setOpenMode] = useState<AttendanceMode>("members");
  const [memberAttendanceList, setMemberAttendanceList] = useState<MemberAttendance[]>([]);
  const [guestAttendanceList, setGuestAttendanceList] = useState<GuestAttendance[]>([]);

  const { data: members } = useQuery({
    queryKey: ["group-members-attendance", groupId],
    queryFn: async () => {
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);
      if (membersError) throw membersError;
      if (!membersData || membersData.length === 0) return [];

      const userIds = membersData.map((m) => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("status", "active")
        .not("full_name", "is", null)
        .neq("full_name", "")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      return sortByText(
        membersData
        .map((m) => {
          const profile = profiles?.find((p) => p.id === m.user_id);
          return {
            user_id: m.user_id,
            profiles: {
              full_name: profile?.full_name,
              avatar_url: profile?.avatar_url || null,
            },
          };
        })
        .filter((m) => m.profiles?.full_name != null)
        .filter((m, i, arr) => arr.findIndex((x) => x.user_id === m.user_id) === i),
        (m) => m.profiles?.full_name || "",
      );
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

  const { data: guestSessions, isLoading: guestSessionsLoading } = useQuery({
    queryKey: ["guest-attendance-sessions", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_attendance_sessions")
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

  const combinedSessions = useMemo(() => {
    const memberSessions = (sessions ?? []).map((s: any) => ({ ...s, _kind: "members" as const }));
    const visitorSessions = (guestSessions ?? []).map((s: any) => ({ ...s, _kind: "guests" as const }));
    return [...memberSessions, ...visitorSessions].sort((a, b) => (b.session_date || "").localeCompare(a.session_date || ""));
  }, [sessions, guestSessions]);

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
        .eq("status", "active")
        .not("full_name", "is", null)
        .neq("full_name", "")
        .in("id", memberIds);

      const summary = memberIds
        .map((id) => {
          const prof = profiles?.find((p) => p.id === id);
          if (!prof?.full_name) return null;
          return {
            id,
            full_name: prof.full_name,
            avatar_url: prof.avatar_url,
            ...map[id],
          };
        })
        .filter(Boolean) as AttendanceSummaryItem[];

      return sortByText(summary, (m) => m.full_name);
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
  });

  const submitMembersMutation = useMutation({
    mutationFn: async () => {
      if (isTest) {
        toast.success("Chamada teste concluída! Nenhum dado foi salvo.");
        setIsOpen(false);
        setMemberAttendanceList([]);
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

      const records = memberAttendanceList.map((m) => ({
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
      setMemberAttendanceList([]);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar"),
  });

  const { data: guestInvitations } = useQuery({
    queryKey: ["guest-invitations-attendance", groupId, sessionDate],
    queryFn: async () => {
      const { data: invites, error } = await supabase
        .from("visitor_invitations")
        .select("id, visitor_name, invited_by, status")
        .eq("group_id", groupId)
        .eq("event_date", sessionDate);
      if (error) throw error;
      const inviterIds = Array.from(new Set((invites ?? []).map((i: any) => i.invited_by).filter(Boolean)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", inviterIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return (invites ?? []).map((inv: any) => ({
        ...inv,
        inviter_profile: profileMap.get(inv.invited_by) || null,
      }));
    },
    enabled: !!groupId && !!sessionDate,
  });

  const submitGuestsMutation = useMutation({
    mutationFn: async () => {
      const { data: session, error: sessionError } = await supabase
        .from("guest_attendance_sessions")
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

      const records = guestAttendanceList.map((g) => ({
        session_id: session.id,
        invitation_id: g.invitation_id,
        invited_by: g.invited_by,
        status: g.status as any,
      }));

      const { error: recError } = await supabase
        .from("guest_attendance_records")
        .insert(records);
      if (recError) throw recError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-attendance-sessions", groupId] });
      toast.success("Lista de convidados enviada para aprovação!");
      setIsOpen(false);
      setGuestAttendanceList([]);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar"),
  });

  const openMembersAttendance = (test: boolean) => {
    setOpenMode("members");
    setIsTest(test);
    setIsOpen(true);
    setGuestAttendanceList([]);
    // Deduplicate members by user_id
    const uniqueMembers = (members || []).filter(
      (m: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.user_id === m.user_id) === i
    );
    const memberList: MemberAttendance[] = uniqueMembers.map((m: any) => ({
      user_id: m.user_id,
      full_name: m.profiles?.full_name || "",
      avatar_url: m.profiles?.avatar_url || null,
      status: "present" as AttendanceStatus,
      substitute_name: "",
    }));
    setMemberAttendanceList(memberList);
  };

  const openGuestAttendance = () => {
    setOpenMode("guests");
    setIsTest(false);
    setIsOpen(true);
    setMemberAttendanceList([]);

    const list: GuestAttendance[] = (guestInvitations ?? []).map((inv: any) => ({
      invitation_id: inv.id,
      visitor_name: inv.visitor_name,
      invited_by: inv.invited_by,
      invited_by_name: inv.inviter_profile?.full_name || "Membro",
      invited_by_avatar_url: inv.inviter_profile?.avatar_url || null,
      status: "present",
    }));
    setGuestAttendanceList(list);
  };

  const updateMemberStatus = (userId: string, status: AttendanceStatus) => {
    setMemberAttendanceList((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, status } : m))
    );
  };

  const updateSubstitute = (userId: string, name: string) => {
    setMemberAttendanceList((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, substitute_name: name } : m))
    );
  };

  const updateGuestStatus = (invitationId: string, status: GuestAttendanceStatus) => {
    setGuestAttendanceList((prev) =>
      prev.map((g) => (g.invitation_id === invitationId ? { ...g, status } : g))
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
        {openMode === "members" && isTest && (
          <div className="bg-warning/10 border border-warning text-warning rounded-lg p-3 text-center text-sm font-medium">
            ⚠️ MODO TESTE — Nenhum dado será salvo
          </div>
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">
            {openMode === "members"
              ? isTest
                ? "🧪 Chamada Teste (Membros)"
                : "📋 Chamada (Membros)"
              : "🎟️ Chamada (Convidados)"}{" "}
            — {new Date(sessionDate + "T12:00:00").toLocaleDateString("pt-BR")}
          </h1>
          <Button
            variant="ghost"
            onClick={() => {
              setIsOpen(false);
              setMemberAttendanceList([]);
              setGuestAttendanceList([]);
            }}
          >
            Cancelar
          </Button>
        </div>

        <div className="space-y-2">
          {openMode === "members"
            ? memberAttendanceList.map((m) => (
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
                      <Button
                        size="sm"
                        variant={m.status === "present" ? "default" : "outline"}
                        onClick={() => updateMemberStatus(m.user_id, "present")}
                        className="border-border text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" /> Presente
                      </Button>
                      <Button
                        size="sm"
                        variant={m.status === "absent" ? "destructive" : "outline"}
                        onClick={() => updateMemberStatus(m.user_id, "absent")}
                        className="border-border text-xs"
                      >
                        <X className="h-3 w-3 mr-1" /> Ausente
                      </Button>
                      <Button
                        size="sm"
                        variant={m.status === "substituted" ? "secondary" : "outline"}
                        onClick={() => updateMemberStatus(m.user_id, "substituted")}
                        className="border-border text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Substituído
                      </Button>
                    </div>
                    {m.status === "substituted" && (
                      <Input
                        placeholder="Nome do substituto"
                        value={m.substitute_name}
                        onChange={(e) => updateSubstitute(m.user_id, e.target.value)}
                        className="bg-muted border-border w-full mt-1 h-9 text-sm"
                      />
                    )}
                  </CardContent>
                </Card>
              ))
            : guestAttendanceList.map((g) => (
                <Card key={g.invitation_id} className="bg-card border-border">
                  <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                    <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold ring-2 ring-secondary/30 shrink-0">
                      {g.visitor_name?.[0] || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{g.visitor_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Convidado por {g.invited_by_name} • vale 2 pts se presente
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={g.status === "present" ? "default" : "outline"}
                        onClick={() => updateGuestStatus(g.invitation_id, "present")}
                        className="border-border text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" /> Presente
                      </Button>
                      <Button
                        size="sm"
                        variant={g.status === "absent" ? "destructive" : "outline"}
                        onClick={() => updateGuestStatus(g.invitation_id, "absent")}
                        className="border-border text-xs"
                      >
                        <X className="h-3 w-3 mr-1" /> Ausente
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {openMode === "members" ? (
          <Button
            onClick={() => submitMembersMutation.mutate()}
            disabled={submitMembersMutation.isPending}
            className={`w-full font-bold uppercase tracking-wider ${isTest ? "bg-warning text-warning-foreground hover:bg-warning/90" : ""}`}
          >
            {submitMembersMutation.isPending
              ? "Enviando..."
              : isTest
              ? "Finalizar Chamada Teste (Membros)"
              : "Finalizar Chamada (Membros) e Enviar para Aprovação"}
          </Button>
        ) : (
          <Button
            onClick={() => submitGuestsMutation.mutate()}
            disabled={submitGuestsMutation.isPending}
            className="w-full font-bold uppercase tracking-wider"
          >
            {submitGuestsMutation.isPending ? "Enviando..." : "Finalizar Chamada (Convidados) e Enviar para Aprovação"}
          </Button>
        )}
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
        <Button onClick={() => openMembersAttendance(false)} className="font-bold uppercase tracking-wider">
          <ClipboardList className="h-4 w-4 mr-2" /> Abrir Chamada (Membros)
        </Button>
        <Button onClick={() => openGuestAttendance()} variant="outline" className="border-border">
          🎟️ Abrir Chamada (Convidados)
        </Button>
        <Button
          variant="outline"
          onClick={() => openMembersAttendance(true)}
          className="border-warning text-warning hover:bg-warning/10"
        >
          <FlaskConical className="h-4 w-4 mr-2" /> 🧪 Chamada Teste (Membros)
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="font-display font-bold text-lg">Chamadas Enviadas</h2>
        {sessionsLoading || guestSessionsLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : !combinedSessions || combinedSessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma chamada registrada</p>
        ) : (
          combinedSessions.map((s: any) => (
            <Card key={`${s._kind}-${s.id}`} className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {s._kind === "guests" ? "🎟️" : "📋"} Lista de Presença ({s._kind === "guests" ? "Convidados" : "Membros"}) —{" "}
                    {new Date(s.session_date + "T12:00:00").toLocaleDateString("pt-BR")}
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

      {/* Member Attendance Summary */}
      {attendanceSummary && attendanceSummary.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Frequência dos Membros
          </h2>
          <div className="space-y-2">
            {attendanceSummary.map((m: any) => (
              <Card key={m.id} className="bg-card border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    {m.avatar_url ? (
                      <AvatarImage src={m.avatar_url} alt={m.full_name} />
                    ) : null}
                    <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                      {m.full_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium flex-1 min-w-0 truncate text-sm">{m.full_name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-xs font-semibold text-success">
                      <Check className="h-3.5 w-3.5" /> {m.present}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                      <X className="h-3.5 w-3.5" /> {m.absent}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
