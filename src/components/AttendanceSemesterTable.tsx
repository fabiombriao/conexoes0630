import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, RefreshCw, CalendarDays, Ban, RotateCcw } from "lucide-react";
import { sortByText } from "@/lib/sortByText";
import {
  recentSemesters,
  semesterFromKey,
  currentSemester,
  ABSENCE_LIMIT,
} from "@/lib/semester";
import { SuspendMemberDialog } from "@/components/SuspendMemberDialog";

interface Props {
  groupId: string;
}

interface MemberRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
  status: string;
}

type RecordStatus = "present" | "absent" | "substituted";

const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

const AttendanceSemesterTable: React.FC<Props> = ({ groupId }) => {
  const { isSuperAdmin } = usePermissions();
  const semesters = useMemo(() => recentSemesters(6), []);
  const [semesterKey, setSemesterKey] = useState(currentSemester().key);
  const semester = useMemo(() => semesterFromKey(semesterKey), [semesterKey]);
  const [dialog, setDialog] = useState<{
    member: MemberRow;
    mode: "suspend" | "reactivate";
    absences: number;
  } | null>(null);

  // Members of the group (active + suspended so suspended ones stay visible).
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["attendance-semester-members", groupId],
    queryFn: async () => {
      const { data: gm, error: gmErr } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);
      if (gmErr) throw gmErr;
      const ids = (gm ?? []).map((m) => m.user_id);
      if (!ids.length) return [] as MemberRow[];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, status")
        .in("id", ids)
        .in("status", ["active", "suspended"])
        .not("full_name", "is", null)
        .neq("full_name", "");
      if (pErr) throw pErr;

      const rows = (profiles ?? [])
        .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
        .map((p) => ({
          id: p.id,
          full_name: p.full_name as string,
          avatar_url: p.avatar_url,
          status: p.status,
        }));
      return sortByText(rows, (r) => r.full_name);
    },
    enabled: !!groupId,
  });

  // Approved (non-test) sessions within the selected semester → table columns.
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["attendance-semester-sessions", groupId, semester.key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("id, session_date")
        .eq("group_id", groupId)
        .eq("status", "approved")
        .eq("is_test", false)
        .gte("session_date", semester.start)
        .lte("session_date", semester.end)
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!groupId,
  });

  const sessionIds = useMemo(() => (sessions ?? []).map((s) => s.id), [sessions]);

  const { data: records } = useQuery({
    queryKey: ["attendance-semester-records", groupId, semester.key, sessionIds],
    queryFn: async () => {
      if (!sessionIds.length) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("session_id, member_id, status")
        .in("session_id", sessionIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!groupId && sessionIds.length > 0,
  });

  // member_id -> session_id -> status
  const matrix = useMemo(() => {
    const map: Record<string, Record<string, RecordStatus>> = {};
    for (const r of records ?? []) {
      if (!map[r.member_id]) map[r.member_id] = {};
      map[r.member_id][r.session_id] = r.status as RecordStatus;
    }
    return map;
  }, [records]);

  // Absences per member in the semester (substituted = excused, not counted).
  const absencesOf = (memberId: string) => {
    const row = matrix[memberId];
    if (!row) return 0;
    return Object.values(row).filter((s) => s === "absent").length;
  };

  const loading = membersLoading || sessionsLoading;

  const cellIcon = (status: RecordStatus | undefined) => {
    if (status === "present")
      return <Check className="h-4 w-4 text-success mx-auto" />;
    if (status === "substituted")
      return <RefreshCw className="h-4 w-4 text-primary mx-auto" />;
    if (status === "absent")
      return <X className="h-4 w-4 text-destructive mx-auto" />;
    return <span className="text-muted-foreground">·</span>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Tabela de Presença
        </h2>
        <Select value={semesterKey} onValueChange={setSemesterKey}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {semesters.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1">
          <Check className="h-3.5 w-3.5 text-success" /> Presente
        </span>
        <span className="flex items-center gap-1">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> Substituído (falta abonada)
        </span>
        <span className="flex items-center gap-1">
          <X className="h-3.5 w-3.5 text-destructive" /> Falta
        </span>
        <span>Limite: {ABSENCE_LIMIT} faltas por semestre</span>
      </p>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !members || members.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum membro encontrado.
          </CardContent>
        </Card>
      ) : (sessions ?? []).length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma chamada aprovada em {semester.label}.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 text-left p-2 min-w-[160px] font-semibold">
                  Membro
                </th>
                {(sessions ?? []).map((s) => (
                  <th
                    key={s.id}
                    className="p-2 text-center font-medium whitespace-nowrap text-xs"
                    title={s.session_date}
                  >
                    {fmtDate(s.session_date)}
                  </th>
                ))}
                <th className="p-2 text-center font-semibold whitespace-nowrap">
                  Faltas
                </th>
                {isSuperAdmin && (
                  <th className="p-2 text-center font-semibold whitespace-nowrap">
                    Ação
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const absences = absencesOf(m.id);
                const overLimit = absences >= ABSENCE_LIMIT;
                const nearLimit = absences === ABSENCE_LIMIT - 1;
                const suspended = m.status === "suspended";
                return (
                  <tr
                    key={m.id}
                    className={
                      suspended
                        ? "border-t border-border bg-destructive/5"
                        : overLimit
                        ? "border-t border-border bg-destructive/5"
                        : "border-t border-border"
                    }
                  >
                    <td className="sticky left-0 z-10 bg-card p-2">
                      <div className="flex items-center gap-2 min-w-[150px]">
                        <Avatar className="h-7 w-7 shrink-0">
                          {m.avatar_url ? (
                            <AvatarImage src={m.avatar_url} alt={m.full_name} />
                          ) : null}
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                            {m.full_name?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium">{m.full_name}</span>
                        {suspended && (
                          <span className="shrink-0 text-[10px] font-bold uppercase text-destructive border border-destructive/40 rounded px-1 py-0.5">
                            Suspenso
                          </span>
                        )}
                      </div>
                    </td>
                    {(sessions ?? []).map((s) => (
                      <td key={s.id} className="p-2 text-center">
                        {cellIcon(matrix[m.id]?.[s.id])}
                      </td>
                    ))}
                    <td
                      className={
                        "p-2 text-center font-bold " +
                        (overLimit
                          ? "text-destructive"
                          : nearLimit
                          ? "text-warning"
                          : "")
                      }
                    >
                      {absences}
                    </td>
                    {isSuperAdmin && (
                      <td className="p-2 text-center whitespace-nowrap">
                        {suspended ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 border-success text-success hover:bg-success/10"
                            onClick={() =>
                              setDialog({ member: m, mode: "reactivate", absences })
                            }
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Reativar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className={
                              "h-7 gap-1 " +
                              (overLimit
                                ? "border-destructive text-destructive hover:bg-destructive/10"
                                : "")
                            }
                            onClick={() =>
                              setDialog({ member: m, mode: "suspend", absences })
                            }
                          >
                            <Ban className="h-3.5 w-3.5" /> Suspender
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <SuspendMemberDialog
          open={!!dialog}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          memberId={dialog.member.id}
          memberName={dialog.member.full_name}
          mode={dialog.mode}
          absences={dialog.absences}
        />
      )}
    </div>
  );
};

export default AttendanceSemesterTable;
