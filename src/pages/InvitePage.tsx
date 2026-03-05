import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useGroupId } from "@/hooks/useGroupId";

const InvitePage: React.FC = () => {
  const { user } = useAuth();
  const { groupId } = useGroupId();
  const [formData, setFormData] = useState({ name: "", email: "", whatsapp: "", profession: "", event_date: "" });
  const [submitted, setSubmitted] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("visitor_invitations").insert({
        group_id: groupId,
        invited_by: user!.id,
        visitor_name: formData.name,
        visitor_email: formData.email,
        visitor_whatsapp: formData.whatsapp,
        visitor_profession: formData.profession,
        event_date: formData.event_date,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Convite criado!");

      const phone = formData.whatsapp.replace(/\D/g, "");
      const dateFormatted = formData.event_date
        ? new Date(formData.event_date + "T12:00:00").toLocaleDateString("pt-BR")
        : "";
      const message = `Oii ${formData.name}! Tudo bem? Estou te enviando o convite para participares do Conexões 06:30 na data ${dateFormatted}. Segue o link para acerto https://www.asaas.com/c/3aje7z27hu4dnev6 😁`;
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar convite"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="space-y-6 max-w-lg">
        <h1 className="text-2xl font-display font-bold">Convidar Visitante</h1>
        <Card className="bg-card border-primary border-2">
          <CardHeader>
            <CardTitle className="font-display text-lg text-primary">Convite Enviado! 🎉</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O link do WhatsApp foi aberto automaticamente com a mensagem de convite.
            </p>
            <Button
              variant="outline"
              className="w-full border-border"
              onClick={() => {
                setSubmitted(false);
                setFormData({ name: "", email: "", whatsapp: "", profession: "", event_date: "" });
              }}
            >
              Criar Outro Convite
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-display font-bold">Convidar Visitante</h1>
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: "name", label: "Nome do visitante", required: true },
              { key: "email", label: "Email", type: "email" },
              { key: "whatsapp", label: "WhatsApp (com DDD)", required: true, placeholder: "51999999999" },
              { key: "profession", label: "Profissão / Empresa" },
              { key: "event_date", label: "Data do evento", type: "date", required: true },
            ].map(({ key, label, type, required, placeholder }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type={type || "text"}
                  value={(formData as any)[key]}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="bg-muted border-border min-h-[48px]"
                  required={required}
                  placeholder={placeholder}
                />
              </div>
            ))}
            <Button type="submit" className="w-full font-bold uppercase tracking-wider min-h-[48px]" disabled={createMutation.isPending}>
              <UserPlus className="h-4 w-4 mr-2" />
              {createMutation.isPending ? "Criando..." : "Criar Convite"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitePage;
