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
import { FileText, Download, ChevronLeft, ChevronRight, ArrowUpDown, X } from "lucide-react";
import { format } from "date-fns";
import { useGroupId } from "@/hooks/useGroupId";

type SortKey = "member" | "contact" | "category" | "temperature" | "status" | "date";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

const TEMP_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  hot: { label: "Quente 🔥", variant: "destructive" },
  warm: { label: "Morna ☀️", variant: "default" },
  cold: { label: "Fria ❄️", variant: "secondary" },
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Nova", variant: "outline" },
  pending: { label: "Em andamento", variant: "default" },
  closed_won: { label: "Fechada ✅", variant: "default" },
  closed_lost: { label: "Perdida", variant: "destructive" },
};

const AdminInvitationsPage: React.FC = () => {
  const { isSuperAdmin, can, isPermissionsLoading } = usePermissions();
  const { groupId, isLoading: groupLoading } = useGroupId();
  const hasAccess = isSuperAdmin || can("view_visitor_invitations") || can("canViewInvitations");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const { data: referrals, isLoading } = useQuery({
    queryKey: ["admin-referrals", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*, profiles:user_id(full_name, avatar_url)")
        .eq("group_id", groupId)
        .eq("type", "referral")
        .order("contribution_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && hasAccess,
  });

  const { data: members } = useQuery({
    queryKey: ["group-members-list", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, profiles:user_id(full_name)")
        .eq("group_id", groupId);
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && hasAccess,
  });

  const filtered = useMemo(() => {
    if (!referrals) return [];
    let result = [...referrals];

    if (startDate) result = result.filter((r) => r.contribution_date >= startDate);
    if (endDate) result = result.filter((r) => r.contribution_date <= endDate);
    if (memberFilter) result = result.filter((r) => r.user_id === memberFilter);

    result.sort((a, b) => {
      let va: string, vb: string;
      switch (sortKey) {
        case "member": va = (a as any).profiles?.full_name || ""; vb = (b as any).profiles?.full_name || ""; break;
        case "contact": va = a.contact_name || ""; vb = b.contact_name || ""; break;
        case "category": va = a.referral_category || ""; vb = b.referral_category || ""; break;
        case "temperature": va = a.temperature || ""; vb = b.temperature || ""; break;
        case "status": va = a.referral_status || ""; vb = b.referral_status || ""; break;
        default: va = a.contribution_date; vb = b.contribution_date;
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    return result;
  }, [referrals, startDate, endDate, memberFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const clearFilters = () => { setStartDate(""); setEndDate(""); setMemberFilter(""); setPage(0); };

  const exportCSV = () => {
    const headers = ["Membro", "Contato", "Categoria", "Temperatura", "Status", "Data"];
    const rows = filtered.map((r: any) => [
      r.profiles?.full_name || "",
      r.contact_name || "",
      r.referral_category || "",
      TEMP_LABELS[r.temperature]?.label || r.temperature || "",
      STATUS_LABELS[r.referral_status]?.label || r.referral_status || "",
      r.contribution_date ? format(new Date(r.contribution_date + "T12:00:00"), "dd/MM/yyyy") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indicacoes_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isPermissionsLoading || groupLoading) return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (!hasAccess) return <Navigate to="/" replace />;

  const SortableHead = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Indicações Realizadas
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

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Nenhuma indicação encontrada</p>
            <p className="text-sm">Ajuste os filtros ou aguarde novas indicações.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <SortableHead label="Membro" k="member" />
                  <SortableHead label="Contato" k="contact" />
                  <SortableHead label="Categoria" k="category" />
                  <SortableHead label="Temperatura" k="temperature" />
                  <SortableHead label="Status" k="status" />
                  <SortableHead label="Data" k="date" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r: any) => {
                  const tempInfo = TEMP_LABELS[r.temperature] || { label: r.temperature || "—", variant: "outline" as const };
                  const statusInfo = STATUS_LABELS[r.referral_status] || { label: r.referral_status || "—", variant: "outline" as const };
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
                      <TableCell className="text-sm">{r.contact_name || "—"}</TableCell>
                      <TableCell className="text-sm">{r.referral_category || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={tempInfo.variant}>{tempInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.contribution_date ? format(new Date(r.contribution_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
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

export default AdminInvitationsPage;
