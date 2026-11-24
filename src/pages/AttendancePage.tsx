import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, RefreshCw, ClipboardList, FlaskConical, MapPin } from "lucide-react";
import { useGroupId } from "@/hooks/useGroupId";
import { sortByText } from "@/lib/sortByText";
import AttendanceSemesterTable from "@/components/AttendanceSemesterTable";

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

  // Membros que confirmaram a própria presença pelo app (GPS, raio de 100 m) na data da chamada.
  const { data: selfCheckins, refetch: refetchSelfCheckins } = useQuery({
    queryKey: ["self-checkins", groupId, sessionDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_self_checkins")
        .select("member_id, checked_in_at, distance_m")
        .eq("group_id", groupId)
        .eq("session_date", sessionDate);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!groupId && !!sessionDate,
  });

  const selfCheckinByMember = useMemo(
    () => new Map((selfCheckins ?? []).map((c) => [c.member_id, c])),
    [selfCheckins],
  );

  // Lista gerada pelas confirmações: confirmou = presente; não confirmou = ausente.
  // Quem o admin já marcou como substituído continua substituído ao atualizar.
  const statusFromCheckins = (memberId: string, confirmed: Set<string>, previous?: AttendanceStatus): AttendanceStatus => {
    if (confirmed.has(memberId)) return "present";
    return previous === "substituted" ? "substituted" : "absent";
  };

  const refreshFromCheckins = async () => {
    const { data } = await refetchSelfCheckins();
    const confirmed = new Set((data ?? []).map((c) => c.member_id));
    setMemberAttendanceList((prev) =>
      prev.map((m) => ({ ...m, status: statusFromCheckins(m.user_id, confirmed, m.status) })),
    );
    toast.success("Lista atualizada com as confirmações mais recentes.");
  };

  // Resumo para a tela inicial: quem já confirmou e quem ainda não, na data selecionada.
  const checkinSummary = useMemo(() => {
    const all = members ?? [];
    const confirmed = all.filter((m: any) => selfCheckinByMember.has(m.user_id));
    const pending = all.filter((m: any) => !selfCheckinByMember.has(m.user_id));
    return { total: all.length, confirmed, pending };
  }, [members, selfCheckinByMember]);

  const combinedSessions = useMemo(() => {
    const memberSessions = (sessions ?? []).map((s: any) => ({ ...s, _kind: "members" as const }));
    const visitorSessions = (guestSessions ?? []).map((s: any) => ({ ...s, _kind: "guests" as const }));
    return [...memberSessions, ...visitorSessions].sort((a, b) => (b.session_date || "").localeCompare(a.session_date || ""));
  }, [sessions, guestSessions]);

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

  const openMembersAttendance = async (test: boolean) => {
    // Busca as confirmações mais recentes antes de montar a lista.
    const { data: freshCheckins } = await refetchSelfCheckins();
    const confirmed = new Set((freshCheckins ?? []).map((c) => c.member_id));
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
      status: statusFromCheckins(m.user_id, confirmed),
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
        <div className="flex flex-wrap items-center justify-between gap-3">
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

        {openMode === "members" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              Lista gerada pelas confirmações no app:{" "}
              {memberAttendanceList.filter((m) => selfCheckinByMember.has(m.user_id)).length} de{" "}
              {memberAttendanceList.length} membros confirmaram. Quem não confirmou aparece como ausente; ajuste o que for
              necessário antes de enviar.
            </span>
            <Button size="sm" variant="outline" onClick={refreshFromCheckins} className="border-border">
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar confirmações
            </Button>
          </div>
        )}

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
                    <div className="flex-1 min-w-0">
                      <span className="font-medium block truncate">{m.full_name}</span>
                      {selfCheckinByMember.has(m.user_id) && (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <MapPin className="h-3 w-3" /> Confirmou presença às{" "}
                          {new Date(selfCheckinByMember.get(m.user_id)!.checked_in_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "America/Sao_Paulo",
                          })}
                        </span>
                      )}
                    </div>
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
          <ClipboardList className="h-4 w-4 mr-2" /> Gerar Lista de Presença (Membros)
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

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Confirmações pelo app —{" "}
              {new Date(sessionDate + "T12:00:00").toLocaleDateString("pt-BR")}
            </h2>
            <span className="text-sm text-muted-foreground">
              {checkinSummary.confirmed.length} de {checkinSummary.total} confirmaram
            </span>
          </div>
          {checkinSummary.confirmed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguém confirmou presença nesta data ainda. Os membros confirmam pelo Dashboard, às terças-feiras das 06:30 às 09:00, estando a até 100 m do local.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {checkinSummary.confirmed.map((m: any) => (
                <span key={m.user_id} className="text-xs px-2 py-1 rounded bg-success/10 text-success">
                  {m.profiles?.full_name}
                </span>
              ))}
            </div>
          )}
          {checkinSummary.pending.length > 0 && checkinSummary.confirmed.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Ainda não confirmaram ({checkinSummary.pending.length})
              </summary>
              <div className="flex flex-wrap gap-2 mt-2">
                {checkinSummary.pending.map((m: any) => (
                  <span key={m.user_id} className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                    {m.profiles?.full_name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display font-bold text-lg">Chamadas Enviadas</h2>
        {sessionsLoading || guestSessionsLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : !combinedSessions || combinedSessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma chamada registrada</p>
        ) : (
          combinedSessions.map((s: any) => (
            <Card key={`${s._kind}-${s.id}`} className="bg-card border-border">
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
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

      {/* School-style semester attendance table */}
      {groupId && <AttendanceSemesterTable groupId={groupId} />}
    </div>
  );
};

export default AttendancePage;
