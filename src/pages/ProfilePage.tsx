import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save } from "lucide-react";
import AvatarUpload from "@/components/AvatarUpload";

const BUSINESS_CATEGORIES = [
  "Advocacia", "Arquitetura", "Consultoria", "Contabilidade", "Coaching",
  "Design", "Educação", "Engenharia", "Finanças", "Imobiliário",
  "Marketing", "Medicina", "Nutrição", "Odontologia", "Psicologia",
  "Seguros", "Tecnologia", "Vendas", "Outro",
];

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [formData, setFormData] = useState<Record<string, any>>({});

  React.useEffect(() => {
    if (profile) setFormData(profile);
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          professional_title: data.professional_title,
          company_name: data.company_name,
          bio: data.bio,
          business_category: data.business_category,
          gains_goals: data.gains_goals,
          gains_accomplishments: data.gains_accomplishments,
          gains_interests: data.gains_interests,
          gains_networks: data.gains_networks,
          gains_skills: data.gains_skills,
          linkedin_url: data.linkedin_url,
          instagram_url: data.instagram_url,
          whatsapp: data.whatsapp,
          website_url: data.website_url,
          video_url: data.video_url,
          profile_completed: true,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: () => toast.error("Erro ao atualizar perfil"),
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg" />)}
    </div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Meu Perfil</h1>
        <Button type="submit" disabled={updateMutation.isPending} className="font-bold uppercase tracking-wider">
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-lg font-display">Informações Básicas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6 pb-2">
            <AvatarUpload
              currentUrl={formData.avatar_url}
              fullName={formData.full_name}
              size={96}
            />
            <div className="text-sm text-muted-foreground">
              Clique na foto para alterar.<br />
              JPEG, PNG ou WebP, máx 5MB.
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={formData.full_name || ""} onChange={(e) => handleChange("full_name", e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Título profissional</Label>
              <Input value={formData.professional_title || ""} onChange={(e) => handleChange("professional_title", e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input value={formData.company_name || ""} onChange={(e) => handleChange("company_name", e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select
                value={formData.business_category || ""}
                onChange={(e) => handleChange("business_category", e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bio (máx 280 caracteres)</Label>
            <Textarea
              value={formData.bio || ""}
              onChange={(e) => handleChange("bio", e.target.value)}
              maxLength={280}
              className="bg-muted border-border"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-lg font-display">Perfil GAINS</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "gains_goals", label: "Goals (Objetivos)" },
            { key: "gains_accomplishments", label: "Accomplishments (Conquistas)" },
            { key: "gains_interests", label: "Interests (Interesses)" },
            { key: "gains_networks", label: "Networks (Redes)" },
            { key: "gains_skills", label: "Skills (Habilidades)" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Textarea
                value={formData[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                className="bg-muted border-border"
                rows={2}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-lg font-display">Links Sociais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "linkedin_url", label: "LinkedIn" },
            { key: "instagram_url", label: "Instagram" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "website_url", label: "Website" },
            { key: "video_url", label: "Vídeo comercial (URL)" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Input value={formData[key] || ""} onChange={(e) => handleChange(key, e.target.value)} className="bg-muted border-border" />
            </div>
          ))}
        </CardContent>
      </Card>
    </form>
  );
};

export default ProfilePage;
