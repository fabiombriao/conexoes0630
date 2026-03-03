import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Flame, Sun, Snowflake } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ContributionType = Database["public"]["Enums"]["contribution_type"];

const TYPE_LABELS: Record<ContributionType, string> = {
  referral: "Referência",
  onf: "ONF",
  one_to_one: "Um-a-Um",
  ueg: "UEG",
  attendance: "Presença",
};

const UEG_POINTS: Record<string, number> = {
  article: 1, podcast: 1, book: 3, msp_training: 2, event: 2, video: 1,
};

const ContributionsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ContributionType | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: contributions, isLoading } = useQuery({
    queryKey: ["contributions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*")
        .eq("user_id", user!.id)
        .order("contribution_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: groupMembership } = useQuery({
    queryKey: ["group-membership", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { error } = await supabase.from("contributions").insert({
        user_id: user!.id,
        group_id: groupMembership?.group_id || "",
        type: selectedType!,
        contribution_date: data.contribution_date || new Date().toISOString().split("T")[0],
        notes: data.notes,
        // Referral
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email,
        referral_category: data.referral_category,
        temperature: data.temperature,
        referral_action: data.referral_action,
        referral_description: data.referral_description,
        // ONF
        business_value: data.business_value ? parseFloat(data.business_value) : null,
        is_repeat_business: data.is_repeat_business === "true",
        closing_date: data.closing_date,
        // 1-2-1
        meeting_location: data.meeting_location,
        meeting_topics: data.meeting_topics?.split(",").map((t: string) => t.trim()),
        // UEG
        ueg_type: data.ueg_type,
        ueg_title: data.ueg_title,
        ueg_url: data.ueg_url,
        ueg_points: data.ueg_type ? UEG_POINTS[data.ueg_type] || 1 : null,
        completion_date: data.completion_date,
        // Attendance
        meeting_date: data.meeting_date,
        attendance_status: data.attendance_status,
        substitute_name: data.substitute_name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDialogOpen(false);
      setSelectedType(null);
      setFormData({});
      toast.success("Contribuição registrada!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupMembership?.group_id) {
      toast.error("Você precisa estar em um grupo para registrar contribuições.");
      return;
    }
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
        <h1 className="text-2xl font-display font-bold">Contribuições PALMS</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold uppercase tracking-wider">
              <Plus className="h-4 w-4 mr-2" />
              Nova Contribuição
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-popover border-border max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Nova Contribuição</DialogTitle>
            </DialogHeader>

            {!selectedType ? (
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(TYPE_LABELS) as ContributionType[]).map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    className="justify-start border-border hover:bg-primary hover:text-primary-foreground"
                    onClick={() => setSelectedType(type)}
                  >
                    {TYPE_LABELS[type]}
                  </Button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                  ← Voltar
                </Button>
                <p className="text-sm text-primary font-bold uppercase">{TYPE_LABELS[selectedType]}</p>

                {selectedType === "referral" && (
                  <>
                    <div className="space-y-2">
                      <Label>Nome do contato</Label>
                      <Input value={formData.contact_name || ""} onChange={(e) => handleChange("contact_name", e.target.value)} className="bg-muted border-border" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input value={formData.contact_phone || ""} onChange={(e) => handleChange("contact_phone", e.target.value)} className="bg-muted border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={formData.contact_email || ""} onChange={(e) => handleChange("contact_email", e.target.value)} className="bg-muted border-border" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Temperatura</Label>
                      <div className="flex gap-2">
                        {[
                          { val: "hot", label: "Quente 🔥" },
                          { val: "warm", label: "Morna 🌤" },
                          { val: "cold", label: "Fria ❄️" },
                        ].map((t) => (
                          <Button
                            key={t.val}
                            type="button"
                            variant={formData.temperature === t.val ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleChange("temperature", t.val)}
                            className="border-border"
                          >
                            {t.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea value={formData.referral_description || ""} onChange={(e) => handleChange("referral_description", e.target.value)} className="bg-muted border-border" rows={3} />
                    </div>
                  </>
                )}

                {selectedType === "onf" && (
                  <>
                    <div className="space-y-2">
                      <Label>Valor do negócio (R$)</Label>
                      <Input type="number" step="0.01" value={formData.business_value || ""} onChange={(e) => handleChange("business_value", e.target.value)} className="bg-muted border-border" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <div className="flex gap-2">
                        {[
                          { val: "false", label: "Negócio Novo" },
                          { val: "true", label: "Negócio Repetido" },
                        ].map((t) => (
                          <Button key={t.val} type="button" variant={formData.is_repeat_business === t.val ? "default" : "outline"} size="sm" onClick={() => handleChange("is_repeat_business", t.val)} className="border-border">
                            {t.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Data do fechamento</Label>
                      <Input type="date" value={formData.closing_date || ""} onChange={(e) => handleChange("closing_date", e.target.value)} className="bg-muted border-border" />
                    </div>
                  </>
                )}

                {selectedType === "one_to_one" && (
                  <>
                    <div className="space-y-2">
                      <Label>Local</Label>
                      <Input value={formData.meeting_location || ""} onChange={(e) => handleChange("meeting_location", e.target.value)} className="bg-muted border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tópicos (separados por vírgula)</Label>
                      <Input value={formData.meeting_topics || ""} onChange={(e) => handleChange("meeting_topics", e.target.value)} className="bg-muted border-border" placeholder="Apresentação, GAINS, Oportunidades" />
                    </div>
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input type="date" value={formData.contribution_date || ""} onChange={(e) => handleChange("contribution_date", e.target.value)} className="bg-muted border-border" />
                    </div>
                  </>
                )}

                {selectedType === "ueg" && (
                  <>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <select value={formData.ueg_type || ""} onChange={(e) => handleChange("ueg_type", e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm" required>
                        <option value="">Selecione...</option>
                        <option value="article">Artigo (1pt)</option>
                        <option value="podcast">Podcast (1pt)</option>
                        <option value="book">Livro (3pts)</option>
                        <option value="msp_training">Treinamento MSP (2pts)</option>
                        <option value="event">Evento (2pts)</option>
                        <option value="video">Vídeo (1pt)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input value={formData.ueg_title || ""} onChange={(e) => handleChange("ueg_title", e.target.value)} className="bg-muted border-border" required />
                    </div>
                    <div className="space-y-2">
                      <Label>URL da fonte</Label>
                      <Input value={formData.ueg_url || ""} onChange={(e) => handleChange("ueg_url", e.target.value)} className="bg-muted border-border" />
                    </div>
                  </>
                )}

                {selectedType === "attendance" && (
                  <>
                    <div className="space-y-2">
                      <Label>Data da reunião</Label>
                      <Input type="date" value={formData.meeting_date || ""} onChange={(e) => handleChange("meeting_date", e.target.value)} className="bg-muted border-border" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="flex gap-2">
                        {[
                          { val: "present", label: "Presente" },
                          { val: "absent", label: "Ausente" },
                          { val: "substituted", label: "Substituído" },
                        ].map((s) => (
                          <Button key={s.val} type="button" variant={formData.attendance_status === s.val ? "default" : "outline"} size="sm" onClick={() => handleChange("attendance_status", s.val)} className="border-border">
                            {s.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {formData.attendance_status === "substituted" && (
                      <div className="space-y-2">
                        <Label>Nome do substituto</Label>
                        <Input value={formData.substitute_name || ""} onChange={(e) => handleChange("substitute_name", e.target.value)} className="bg-muted border-border" />
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.notes || ""} onChange={(e) => handleChange("notes", e.target.value)} className="bg-muted border-border" rows={2} />
                </div>

                <Button type="submit" className="w-full font-bold uppercase tracking-wider" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Registrar"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
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
                    {TYPE_LABELS[c.type as ContributionType]}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {c.type === "referral" && c.contact_name}
                      {c.type === "onf" && `R$ ${Number(c.business_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      {c.type === "one_to_one" && (c.meeting_location || "Um-a-Um")}
                      {c.type === "ueg" && c.ueg_title}
                      {c.type === "attendance" && `${c.attendance_status === "present" ? "Presente" : c.attendance_status === "absent" ? "Ausente" : "Substituído"}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.contribution_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                {c.type === "referral" && c.temperature && tempIcon(c.temperature)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContributionsPage;
