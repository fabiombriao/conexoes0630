import React, { useRef, useState } from "react";
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
  const inviteWindowRef = useRef<Window | null>(null);

  const buildWhatsAppUrl = (payload: typeof formData) => {
    const phoneDigits = payload.whatsapp.replace(/\D/g, "");
    if (!phoneDigits) {
      throw new Error("Informe um WhatsApp válido com DDD.");
    }

    const phone = phoneDigits.length === 10 || phoneDigits.length === 11 ? `55${phoneDigits}` : phoneDigits;
    const dateFormatted = payload.event_date
      ? new Date(`${payload.event_date}T12:00:00`).toLocaleDateString("pt-BR")
      : "";
    const message = `Oii ${payload.name}! Tudo bem? Estou te enviando o convite para participares do Conexões 06:30 na data ${dateFormatted}. Segue o link para acerto https://www.asaas.com/c/3aje7z27hu4dnev6 😁`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData & { waUrl: string }) => {
      const { data, error } = await supabase.from("visitor_invitations").insert({
        group_id: groupId,
        invited_by: user!.id,
        visitor_name: payload.name,
        visitor_email: payload.email,
        visitor_whatsapp: payload.whatsapp,
        visitor_profession: payload.profession,
        event_date: payload.event_date,
      }).select().single();

      if (error) throw error;
      return { data, waUrl: payload.waUrl };
    },
    onSuccess: ({ waUrl }) => {
      setSubmitted(true);
      toast.success("Convite criado!");

      const popup = inviteWindowRef.current;
      if (popup && !popup.closed) {
        popup.location.href = waUrl;
        popup.focus();
      } else {
        window.location.assign(waUrl);
      }

      inviteWindowRef.current = null;
    },
    onError: (e: any) => {
      inviteWindowRef.current?.close();
      inviteWindowRef.current = null;
      toast.error(e.message || "Erro ao criar convite");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const waUrl = buildWhatsAppUrl(formData);
      inviteWindowRef.current = window.open("about:blank", "_blank");
      if (inviteWindowRef.current) {
        try {
          inviteWindowRef.current.opener = null;
        } catch {
          // Some browsers block changing opener after opening a new tab.
        }
      }
      createMutation.mutate({ ...formData, waUrl });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar link do WhatsApp");
    }
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
