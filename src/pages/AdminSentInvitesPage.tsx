import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Download, ChevronLeft, ChevronRight, ArrowUpDown, X } from "lucide-react";
import { format } from "date-fns";
import { useGroupId } from "@/hooks/useGroupId";

type SortKey = "member" | "visitor" | "whatsapp" | "event_date" | "status" | "created_at";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "default" },
  declined: { label: "Recusado", variant: "destructive" },
};

const AdminSentInvitesPage: React.FC = () => {
  const { isSuperAdmin, isPermissionsLoading } = usePermissions();
  const { groupId, isLoading: groupLoading } = useGroupId();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const ready = !isPermissionsLoading && !groupLoading && !!groupId && isSuperAdmin;

  const { data: invitations, isLoading } = useQuery({
    queryKey: ["admin-sent-invites", groupId],
    queryFn: async () => {
      // Fetch invitations and profiles separately to avoid RLS join issues
      const { data: invites, error } = await supabase
        .from("visitor_invitations")
        .select("*")
        .eq("group_id", groupId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch inviter profiles
      const inviterIds = [...new Set((invites ?? []).map((i) => i.invited_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", inviterIds);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (invites ?? []).map((inv) => ({
        ...inv,
        profiles: profileMap.get(inv.invited_by) || null,
      }));
    },
    enabled: ready,
  });

  const { data: members } = useQuery({
    queryKey: ["group-members-list", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, profiles:user_id(full_name)")
        .eq("group_id", groupId!);
      if (error) throw error;
      return data;
    },
    enabled: ready,
  });

  const filtered = useMemo(() => {
    if (!invitations) return [];
    let result = [...invitations];

    if (startDate) result = result.filter((r) => r.created_at >= startDate);
    if (endDate) result = result.filter((r) => r.created_at <= endDate + "T23:59:59");
    if (memberFilter) result = result.filter((r) => r.invited_by === memberFilter);

    result.sort((a, b) => {
      let va: string, vb: string;
      switch (sortKey) {
        case "member": va = (a as any).profiles?.full_name || ""; vb = (b as any).profiles?.full_name || ""; break;
        case "visitor": va = a.visitor_name; vb = b.visitor_name; break;
        case "whatsapp": va = a.visitor_whatsapp || ""; vb = b.visitor_whatsapp || ""; break;
        case "status": va = a.status; vb = b.status; break;
        case "event_date": va = a.event_date; vb = b.event_date; break;
        default: va = a.created_at; vb = b.created_at;
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    return result;
  }, [invitations, startDate, endDate, memberFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const clearFilters = () => { setStartDate(""); setEndDate(""); setMemberFilter(""); setPage(0); };

  const exportCSV = () => {
    const headers = ["Membro", "Visitante", "WhatsApp", "Data do Evento", "Status", "Enviado em"];
    const rows = filtered.map((r: any) => [
      r.profiles?.full_name || "",
      r.visitor_name,
      r.visitor_whatsapp || "",
      r.event_date ? format(new Date(r.event_date + "T12:00:00"), "dd/MM/yyyy") : "",
      STATUS_LABELS[r.status]?.label || r.status,
      r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `convites_enviados_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isPermissionsLoading && !isSuperAdmin) return <Navigate to="/" replace />;

  const SortableHead = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary" /> Convites Enviados
        </h1>
        <Button variant="outline" onClick={exportCSV} className="gap-2" disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data início</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0); }} className="bg-muted border-border w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data fim</Label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0); }} className="bg-muted border-border w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Membro</Label>
              <select
                value={memberFilter}
                onChange={(e) => { setMemberFilter(e.target.value); setPage(0); }}
                className="flex h-10 rounded-md border border-border bg-muted px-3 py-2 text-sm w-48"
              >
                <option value="">Todos</option>
                {members?.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || "Sem nome"}</option>
                ))}
              </select>
            </div>
            {(startDate || endDate || memberFilter) && (
              <button onClick={clearFilters} className="text-xs text-primary hover:underline flex items-center gap-1 pb-2">
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading || isPermissionsLoading || groupLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center text-muted-foreground">
            <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Nenhum convite encontrado</p>
            <p className="text-sm">Ajuste os filtros ou aguarde novos convites.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <SortableHead label="Membro" k="member" />
                  <SortableHead label="Visitante" k="visitor" />
                  <SortableHead label="WhatsApp" k="whatsapp" />
                  <SortableHead label="Data Evento" k="event_date" />
                  <SortableHead label="Status" k="status" />
                  <SortableHead label="Enviado em" k="created_at" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r: any) => {
                  const statusInfo = STATUS_LABELS[r.status] || { label: r.status, variant: "outline" as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold ring-1 ring-primary/30 shrink-0">
                            {r.profiles?.avatar_url ? (
                              <img src={r.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              r.profiles?.full_name?.[0] || "?"
                            )}
                          </div>
                          <span className="text-sm truncate">{r.profiles?.full_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.visitor_name}</TableCell>
                      <TableCell className="text-sm font-mono">{r.visitor_whatsapp || "—"}</TableCell>
                      <TableCell className="text-sm">{r.event_date ? format(new Date(r.event_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {filtered.length} resultado{filtered.length !== 1 && "s"} — Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminSentInvitesPage;
