import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Flame, Sun, Snowflake } from "lucide-react";
import { useGroupId } from "@/hooks/useGroupId";
import { sortByText } from "@/lib/sortByText";

type ContributionType = "one_to_one" | "referral" | "onf";

type ContributionRow = {
  id: string;
  user_id: string;
  group_id: string;
  type: ContributionType;
  contribution_date: string;
  notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  referral_category: string | null;
  temperature: string | null;
  referral_action: string | null;
  referral_description: string | null;
  referred_to: string | null;
  business_value: number | null;
  is_repeat_business: boolean | null;
  closing_date: string | null;
  meeting_location: string | null;
  meeting_topics: string[] | null;
  meeting_member_id: string | null;
  meeting_date: string | null;
  meeting_confirmation_status: string | null;
  meeting_confirmed_by: string | null;
  meeting_confirmed_at: string | null;
  meeting_declined_by: string | null;
  meeting_declined_at: string | null;
  created_at: string;
};

type GroupMemberOption = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};

const TYPE_LABELS: Record<ContributionType, string> = {
  one_to_one: "T — Téte a téte",
  referral: "R — Recomendações",
  onf: "N — Negócios Fechados",
};

const TIN_ORDER: ContributionType[] = ["one_to_one", "referral", "onf"];

const TIN_POINTS: Record<ContributionType, number> = {
  one_to_one: 2,
  referral: 1,
  onf: 3,
};

const ONE_TO_ONE_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Aguardando aceite", className: "bg-warning/15 text-warning border-warning/25" },
  confirmed: { label: "Confirmado", className: "bg-success/15 text-success border-success/25" },
  declined: { label: "Recusado", className: "bg-destructive/15 text-destructive border-destructive/25" },
};

const TOPICS = ["Apresentação", "GAINS", "Oportunidades", "Estratégia", "Suporte"];

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

const ContributionsPage: React.FC = () => {
  const { user } = useAuth();
  const { groupId } = useGroupId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ContributionType | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<ContributionRow | null>(null);

  const { data: contributions, isLoading } = useQuery<ContributionRow[]>({
    queryKey: ["contributions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("id, user_id, group_id, type, contribution_date, notes, contact_name, contact_phone, contact_email, referral_category, temperature, referral_action, referral_description, referred_to, business_value, is_repeat_business, closing_date, meeting_location, meeting_topics, meeting_member_id, meeting_date, meeting_confirmation_status, meeting_confirmed_by, meeting_confirmed_at, meeting_declined_by, meeting_declined_at, created_at")
        .eq("user_id", user!.id)
        .in("type", ["one_to_one", "referral", "onf"])
        .order("contribution_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: incomingPending = [], isLoading: incomingPendingLoading } = useQuery<ContributionRow[]>({
    queryKey: ["one-to-one-incoming-pending", user?.id, groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("id, user_id, group_id, type, contribution_date, notes, contact_name, contact_phone, contact_email, referral_category, temperature, referral_action, referral_description, referred_to, business_value, is_repeat_business, closing_date, meeting_location, meeting_topics, meeting_member_id, meeting_date, meeting_confirmation_status, meeting_confirmed_by, meeting_confirmed_at, meeting_declined_by, meeting_declined_at, created_at")
        .eq("meeting_member_id", user!.id)
        .eq("type", "one_to_one")
        .eq("meeting_confirmation_status", "pending")
        .order("contribution_date", { ascending: false });
      if (error) throw error;
      return data as ContributionRow[];
    },
    enabled: !!user && !!groupId,
  });

  const { data: groupMembers } = useQuery<GroupMemberOption[]>({
    queryKey: ["group-members-select", groupId],
    queryFn: async () => {
      // First get group member user_ids
      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      // Then get profiles for those user_ids
      const userIds = members.map((m) => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("status", "active")
        .not("full_name", "is", null)
        .neq("full_name", "")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      return (profiles || [])
        .filter((p) => p.full_name != null)
        .map((p) => ({
          user_id: p.id,
          full_name: p.full_name || "",
          avatar_url: p.avatar_url,
        }));
    },
    enabled: !!groupId,
  });

  const sortedGroupMembers = sortByText(
    (groupMembers ?? []).filter((m) => m.user_id !== user?.id),
    (m) => m.full_name,
  );

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { error } = await supabase.from("contributions").insert({
        user_id: user!.id,
        group_id: groupId,
        type: selectedType!,
        contribution_date: data.contribution_date || new Date().toISOString().split("T")[0],
        notes: data.notes,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email,
        referral_category: data.referral_category,
        temperature: data.temperature,
        referral_action: data.referral_action,
        referral_description: data.referral_description,
        referred_to: data.referred_to,
        business_value: data.business_value ? parseFloat(data.business_value) : null,
        is_repeat_business: data.is_repeat_business === "true",
        closing_date: data.closing_date,
        meeting_location: data.meeting_location,
        meeting_topics: selectedTopics.length > 0 ? selectedTopics : null,
        meeting_member_id: data.meeting_member_id,
        meeting_date: data.meeting_date,
        meeting_confirmation_status: selectedType === "one_to_one" ? "pending" : null,
        meeting_confirmed_by: null,
        meeting_confirmed_at: null,
        meeting_declined_by: null,
        meeting_declined_at: null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      // Atualizar ranking
      if (groupId && user && selectedType && selectedType !== "one_to_one") {
        const monthKey = getCurrentMonthKey();
        const pointsMap: Record<string, { tt?: number; indication?: number; deal?: number }> = {
          one_to_one: { tt: TIN_POINTS.one_to_one },
          referral: { indication: TIN_POINTS.referral },
          onf: { deal: TIN_POINTS.onf },
        };
        const pts = pointsMap[selectedType] || {};

        try {
          await supabase.rpc("upsert_ranking_points", {
            _group_id: groupId,
            _member_id: user.id,
            _month: monthKey,
            _tt: pts.tt,
            _indication: pts.indication,
            _deal: pts.deal,
          });

          await supabase.rpc("recalculate_ranking_positions", {
            _group_id: groupId,
            _month: monthKey,
          });
        } catch (err: any) {
          console.error("Erro ao atualizar ranking:", err);
          // Não mostrar toast de erro para não atrapalhar o fluxo principal
        }
      }

      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["one-to-one-incoming-pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-rankings"] });
      setDialogOpen(false);
      setSelectedType(null);
      setFormData({});
      setSelectedTopics([]);
      toast.success("Contribuição registrada!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
  });

  const resolveOneToOneMutation = useMutation({
    mutationFn: async ({ contributionId, accepted }: { contributionId: string; accepted: boolean }) => {
      const { error } = await supabase.rpc("resolve_one_to_one_contribution", {
        _contribution_id: contributionId,
        _accepted: accepted,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["one-to-one-incoming-pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-rankings"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
      toast.success("Resposta registrada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao responder a TRN"),
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const tempIcon = (t: string | null) => {
    if (t === "hot") return <Flame className="h-4 w-4 text-destructive" />;
    if (t === "warm") return <Sun className="h-4 w-4 text-warning" />;
    return <Snowflake className="h-4 w-4 text-blue-400" />;
  };

  const getMemberName = (memberId: string | null) =>
    sortedGroupMembers.find((m) => m.user_id === memberId)?.full_name || null;

  const getContributionTitle = (c: ContributionRow) => {
    if (c.type === "one_to_one") {
      return getMemberName(c.meeting_member_id) || c.meeting_location || "Téte a téte";
    }
    if (c.type === "referral") {
      return c.contact_name || "Recomendação";
    }
    return `R$ ${Number(c.business_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const getOneToOneStatus = (c: ContributionRow) => {
    if (c.type !== "one_to_one") return null;
    if (c.meeting_confirmation_status === "confirmed") return ONE_TO_ONE_STATUS_META.confirmed;
    if (c.meeting_confirmation_status === "declined") return ONE_TO_ONE_STATUS_META.declined;
    return ONE_TO_ONE_STATUS_META.pending;
  };

  const pendingCount = incomingPending.length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Minhas TRN's</h1>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setSelectedType(null); setFormData({}); setSelectedTopics([]); } }}>
          <DialogTrigger asChild>
            <Button className="font-bold uppercase tracking-wider">
              <Plus className="h-4 w-4 mr-2" />
              Nova Contribuição
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-popover border-border max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Nova Contribuição TRN</DialogTitle>
            </DialogHeader>

            {!selectedType ? (
              <div className="grid grid-cols-1 gap-2">
                {TIN_ORDER.map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    className="justify-start border-border hover:bg-primary hover:text-primary-foreground text-left"
                    onClick={() => setSelectedType(type)}
                  >
                    <span className="flex-1">{TYPE_LABELS[type]}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">
                      {TIN_POINTS[type]} pts
                    </span>
                  </Button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedType(null); setFormData({}); setSelectedTopics([]); }}>
                  ← Voltar
                </Button>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-primary font-bold uppercase">{TYPE_LABELS[selectedType]}</p>
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    {TIN_POINTS[selectedType]} pts
                  </span>
                </div>

                {selectedType === "one_to_one" && (
                  <>
                    <div className="space-y-2">
                      <Label>Membro do encontro</Label>
                      <select
                        value={formData.meeting_member_id || ""}
                        onChange={(e) => handleChange("meeting_member_id", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Selecione...</option>
                         {sortedGroupMembers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Data</Label>
                        <Input type="date" value={formData.contribution_date || ""} onChange={(e) => handleChange("contribution_date", e.target.value)} className="bg-muted border-border min-h-[48px]" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Local</Label>
                        <Input value={formData.meeting_location || ""} onChange={(e) => handleChange("meeting_location", e.target.value)} className="bg-muted border-border min-h-[48px]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Tópicos</Label>
                      <div className="flex flex-wrap gap-2">
                        {TOPICS.map((t) => (
                          <Button
                            key={t}
                            type="button"
                            size="sm"
                            variant={selectedTopics.includes(t) ? "default" : "outline"}
                            className="border-border"
                            onClick={() => toggleTopic(t)}
                          >
                            {t}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedType === "referral" && (
                  <>
                    <div className="space-y-2">
                      <Label>Indicado para</Label>
                      <select
                        value={formData.referred_to || ""}
                        onChange={(e) => handleChange("referred_to", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Selecione o membro...</option>
                        {sortedGroupMembers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do contato</Label>
                      <Input value={formData.contact_name || ""} onChange={(e) => handleChange("contact_name", e.target.value)} className="bg-muted border-border min-h-[48px]" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input value={formData.contact_phone || ""} onChange={(e) => handleChange("contact_phone", e.target.value)} className="bg-muted border-border min-h-[48px]" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={formData.contact_email || ""} onChange={(e) => handleChange("contact_email", e.target.value)} className="bg-muted border-border min-h-[48px]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Temperatura</Label>
                      <div className="flex gap-2">
                        {[
                          { val: "hot", label: "Quente 🔥" },
                          { val: "warm", label: "Morno 🌤" },
                          { val: "cold", label: "Frio ❄️" },
                        ].map((t) => (
                          <Button key={t.val} type="button" variant={formData.temperature === t.val ? "default" : "outline"} size="sm" onClick={() => handleChange("temperature", t.val)} className="border-border">
                            {t.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea value={formData.referral_description || ""} onChange={(e) => handleChange("referral_description", e.target.value)} className="bg-muted border-border" rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ação tomada</Label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { val: "called", label: "Ligou" },
                          { val: "scheduled", label: "Agendou" },
                          { val: "email", label: "E-mail" },
                          { val: "in_person", label: "Pessoalmente" },
                        ].map((a) => (
                          <Button key={a.val} type="button" variant={formData.referral_action === a.val ? "default" : "outline"} size="sm" onClick={() => handleChange("referral_action", a.val)} className="border-border">
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input type="date" value={formData.contribution_date || ""} onChange={(e) => handleChange("contribution_date", e.target.value)} className="bg-muted border-border min-h-[48px]" />
                    </div>
                  </>
                )}

                {selectedType === "onf" && (
                  <>
                    <div className="space-y-2">
                      <Label>Valor do negócio (R$)</Label>
                      <Input type="number" step="0.01" value={formData.business_value || ""} onChange={(e) => handleChange("business_value", e.target.value)} className="bg-muted border-border min-h-[48px] text-2xl font-display font-bold text-primary" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Negócio fechado com membro do grupo?</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant={formData.deal_with_member === "yes" ? "default" : "outline"} size="sm" onClick={() => handleChange("deal_with_member", "yes")} className="border-border">Sim</Button>
                        <Button type="button" variant={formData.deal_with_member === "no" || !formData.deal_with_member ? "default" : "outline"} size="sm" onClick={() => { handleChange("deal_with_member", "no"); handleChange("referred_to", ""); }} className="border-border">Não</Button>
                      </div>
                    </div>
                    {formData.deal_with_member === "yes" && (
                      <div className="space-y-2">
                        <Label>Membro do grupo</Label>
                        <select
                          value={formData.referred_to || ""}
                          onChange={(e) => handleChange("referred_to", e.target.value)}
                          className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                          required
                        >
                          <option value="">Selecione o membro...</option>
                          {sortedGroupMembers.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <div className="flex gap-2">
                        {[
                          { val: "false", label: "Novo negócio" },
                          { val: "true", label: "Negócio recorrente" },
                        ].map((t) => (
                          <Button key={t.val} type="button" variant={formData.is_repeat_business === t.val ? "default" : "outline"} size="sm" onClick={() => handleChange("is_repeat_business", t.val)} className="border-border">
                            {t.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Data do fechamento</Label>
                      <Input type="date" value={formData.closing_date || ""} onChange={(e) => handleChange("closing_date", e.target.value)} className="bg-muted border-border min-h-[48px]" />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.notes || ""} onChange={(e) => handleChange("notes", e.target.value)} className="bg-muted border-border" rows={2} />
                </div>

                <Button type="submit" className="w-full font-bold uppercase tracking-wider min-h-[48px]" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Registrar"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {pendingCount > 0 && (
        <Card className="bg-primary/10 border-primary">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-primary">TRNs aguardando seu aceite</p>
                <p className="text-sm text-muted-foreground">
                  Você tem {pendingCount} {pendingCount === 1 ? "reunião" : "reuniões"} Téte-a-téte para confirmar.
                </p>
              </div>
              {incomingPendingLoading && <span className="text-xs text-muted-foreground">Carregando...</span>}
            </div>

            <div className="space-y-3">
              {incomingPending.map((item) => {
                const statusMeta = getOneToOneStatus(item);
                return (
                  <Card key={item.id} className="bg-card border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {getMemberName(item.user_id) || "Membro"} quer confirmar um Téte-a-téte com você
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(item.contribution_date).toLocaleDateString("pt-BR")}
                            {item.meeting_location ? ` • ${item.meeting_location}` : ""}
                          </p>
                        </div>
                        {statusMeta && <Badge className={statusMeta.className}>{statusMeta.label}</Badge>}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="font-semibold"
                          onClick={() => resolveOneToOneMutation.mutate({ contributionId: item.id, accepted: true })}
                          disabled={resolveOneToOneMutation.isPending}
                        >
                          Confirmar e pontuar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border text-destructive hover:bg-destructive/10"
                          onClick={() => resolveOneToOneMutation.mutate({ contributionId: item.id, accepted: false })}
                          disabled={resolveOneToOneMutation.isPending}
                        >
                          Recusar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreviewItem(item)}
                          disabled={resolveOneToOneMutation.isPending}
                        >
                          Ver detalhes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : contributions?.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg mb-2">Nenhuma contribuição ainda</p>
            <p className="text-sm">Clique em "+ Nova Contribuição" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contributions?.map((c) => (
            <Card
              key={c.id}
              className="bg-card border-border card-hover-border cursor-pointer"
              onClick={() => setPreviewItem(c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPreviewItem(c);
                }
              }}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded">
                    {TYPE_LABELS[c.type as ContributionType] || c.type}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {getContributionTitle(c)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.contribution_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.type === "referral" && tempIcon(c.temperature)}
                  {c.type === "one_to_one" && (() => {
                    const statusMeta = getOneToOneStatus(c);
                    return statusMeta ? (
                      <Badge className={`text-[10px] ${statusMeta.className}`}>{statusMeta.label}</Badge>
                    ) : null;
                  })()}
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                    {TIN_POINTS[c.type as ContributionType] || 0} pts
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="bg-popover border-border max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded">
                {previewItem ? (TYPE_LABELS[previewItem.type] || previewItem.type) : ""}
              </span>
              <span>Detalhes da contribuição</span>
            </DialogTitle>
            <DialogDescription>
              Visualização do que foi preenchido no registro.
            </DialogDescription>
          </DialogHeader>

          {previewItem && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data</Label>
                  <p className="text-sm">{new Date(previewItem.contribution_date).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <p className="text-sm">{TYPE_LABELS[previewItem.type]}</p>
                </div>
              </div>

              {previewItem.type === "one_to_one" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div>
                      {(() => {
                        const statusMeta = getOneToOneStatus(previewItem);
                        return statusMeta ? <Badge className={statusMeta.className}>{statusMeta.label}</Badge> : null;
                      })()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Com quem foi</Label>
                    <p className="text-sm font-medium">
                      {getMemberName(previewItem.meeting_member_id) || previewItem.meeting_location || "Téte a téte"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Local</Label>
                    <p className="text-sm">{previewItem.meeting_location || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data da reunião</Label>
                    <p className="text-sm">{previewItem.meeting_date ? new Date(previewItem.meeting_date).toLocaleDateString("pt-BR") : "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tópicos</Label>
                    <p className="text-sm">{previewItem.meeting_topics?.length ? previewItem.meeting_topics.join(", ") : "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Observações</Label>
                    <p className="text-sm whitespace-pre-wrap">{previewItem.notes || "—"}</p>
                  </div>

                  {previewItem.meeting_confirmation_status === "pending" && previewItem.meeting_member_id === user?.id && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        className="font-semibold"
                        onClick={() => resolveOneToOneMutation.mutate({ contributionId: previewItem.id, accepted: true })}
                        disabled={resolveOneToOneMutation.isPending}
                      >
                        Confirmar e pontuar
                      </Button>
                      <Button
                        variant="outline"
                        className="border-border text-destructive hover:bg-destructive/10"
                        onClick={() => resolveOneToOneMutation.mutate({ contributionId: previewItem.id, accepted: false })}
                        disabled={resolveOneToOneMutation.isPending}
                      >
                        Recusar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {previewItem.type === "referral" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Indicado para</Label>
                      <p className="text-sm font-medium">
                        {getMemberName(previewItem.referred_to) || "Membro do grupo"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Temperatura</Label>
                      <p className="text-sm">{previewItem.temperature || "—"}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Contato</Label>
                    <p className="text-sm">{previewItem.contact_name || "—"}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Telefone</Label>
                      <p className="text-sm">{previewItem.contact_phone || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">E-mail</Label>
                      <p className="text-sm">{previewItem.contact_email || "—"}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Descrição</Label>
                    <p className="text-sm whitespace-pre-wrap">{previewItem.referral_description || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Observações</Label>
                    <p className="text-sm whitespace-pre-wrap">{previewItem.notes || "—"}</p>
                  </div>
                </div>
              )}

              {previewItem.type === "onf" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Valor</Label>
                      <p className="text-sm font-medium">
                        R$ {Number(previewItem.business_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo</Label>
                      <p className="text-sm">{previewItem.is_repeat_business ? "Negócio recorrente" : "Novo negócio"}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Fechado com</Label>
                    <p className="text-sm">
                      {previewItem.referred_to
                        ? getMemberName(previewItem.referred_to) || "Membro do grupo"
                        : "Cliente externo"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data do fechamento</Label>
                    <p className="text-sm">{previewItem.closing_date ? new Date(previewItem.closing_date).toLocaleDateString("pt-BR") : "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Observações</Label>
                    <p className="text-sm whitespace-pre-wrap">{previewItem.notes || "—"}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContributionsPage;
