import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Flame, Sun, Snowflake } from "lucide-react";
import { useGroupId } from "@/hooks/useGroupId";

type ContributionType = "one_to_one" | "referral" | "onf";

const TYPE_LABELS: Record<ContributionType, string> = {
  one_to_one: "T — Téte a téte",
  referral: "I — Indicações",
  onf: "M — Negócios Fechados",
};

const TIM_ORDER: ContributionType[] = ["one_to_one", "referral", "onf"];

const TIM_POINTS: Record<ContributionType, number> = {
  one_to_one: 2,
  referral: 1,
  onf: 3,
};

const TOPICS = ["Apresentação", "GAINS", "Oportunidades", "Estratégia", "Suporte"];

const ContributionsPage: React.FC = () => {
  const { user } = useAuth();
  const { groupId } = useGroupId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ContributionType | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const { data: contributions, isLoading } = useQuery({
    queryKey: ["contributions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*")
        .eq("user_id", user!.id)
        .in("type", ["one_to_one", "referral", "onf"])
        .order("contribution_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: groupMembers } = useQuery({
    queryKey: ["group-members-select", groupId],
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDialogOpen(false);
      setSelectedType(null);
      setFormData({});
      setSelectedTopics([]);
      toast.success("Contribuição registrada!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Minhas Contribuições TIM</h1>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setSelectedType(null); setFormData({}); setSelectedTopics([]); } }}>
          <DialogTrigger asChild>
            <Button className="font-bold uppercase tracking-wider">
              <Plus className="h-4 w-4 mr-2" />
              Nova Contribuição
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-popover border-border max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Nova Contribuição TIM</DialogTitle>
            </DialogHeader>

            {!selectedType ? (
              <div className="grid grid-cols-1 gap-2">
                {TIM_ORDER.map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    className="justify-start border-border hover:bg-primary hover:text-primary-foreground text-left"
                    onClick={() => setSelectedType(type)}
                  >
                    <span className="flex-1">{TYPE_LABELS[type]}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">
                      {TIM_POINTS[type]} pts
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
                    {TIM_POINTS[selectedType]} pts
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
                        {groupMembers?.filter((m: any) => m.user_id !== user?.id).map((m: any) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.profiles?.full_name || "Membro"}
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
                        {groupMembers?.filter((m: any) => m.user_id !== user?.id).map((m: any) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.profiles?.full_name || "Membro"}
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
            <Card key={c.id} className="bg-card border-border card-hover-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded">
                    {TYPE_LABELS[c.type as ContributionType] || c.type}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {c.type === "referral" && c.contact_name}
                      {c.type === "onf" && `R$ ${Number(c.business_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      {c.type === "one_to_one" && (c.meeting_location || "Téte a téte")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.contribution_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.type === "referral" && tempIcon(c.temperature)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContributionsPage;
