import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, UserPlus } from "lucide-react";
import { useGroupId } from "@/hooks/useGroupId";
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from "@/lib/whatsapp";

type InviteForm = { name: string; email: string; whatsapp: string; profession: string; event_date: string };
type SentInvite = { name: string; phone: string; url: string; message: string };

const EMPTY_FORM: InviteForm = { name: "", email: "", whatsapp: "", profession: "", event_date: "" };

type FormField = {
  key: keyof InviteForm;
  label: string;
  type?: "text" | "email" | "date";
  required?: boolean;
  placeholder?: string;
};

const FORM_FIELDS = [
  { key: "name", label: "Nome do visitante", required: true },
  { key: "email", label: "Email", type: "email" },
  { key: "whatsapp", label: "WhatsApp (com DDD)", required: true, placeholder: "51999999999" },
  { key: "profession", label: "Profissão / Empresa" },
  { key: "event_date", label: "Data do evento", type: "date", required: true },
] satisfies FormField[];

const buildInviteMessage = (name: string, eventDate: string) => {
  const dateFormatted = eventDate
    ? new Date(`${eventDate}T12:00:00`).toLocaleDateString("pt-BR")
    : "";
  return `Oii ${name}! Tudo bem? Estou te enviando o convite para participares do Conexões 06:30 na data ${dateFormatted}. Segue o link para confirmar sua inscrição: https://www.asaas.com/c/3aje7z27hu4dnev6 😁`;
};

const InvitePage: React.FC = () => {
  const { user } = useAuth();
  const { groupId } = useGroupId();
  const [formData, setFormData] = useState<InviteForm>(EMPTY_FORM);
  const [sentInvite, setSentInvite] = useState<SentInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (payload: InviteForm & { sent: SentInvite }) => {
      const { error } = await supabase.from("visitor_invitations").insert({
        group_id: groupId,
        invited_by: user!.id,
        visitor_name: payload.name,
        visitor_email: payload.email,
        visitor_whatsapp: payload.whatsapp,
        visitor_profession: payload.profession,
        event_date: payload.event_date,
      }).select().single();

      if (error) throw error;
      return payload.sent;
    },
    onSuccess: (sent) => {
      toast.success("Convite criado!");
      setSentInvite(sent);
      setFormData(EMPTY_FORM);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error && e.message ? e.message : "Erro ao criar convite");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const phone = normalizeWhatsAppPhone(formData.whatsapp);
      if (!phone) {
        throw new Error("Informe um WhatsApp válido com DDD.");
      }
      const message = buildInviteMessage(formData.name, formData.event_date);
      const url = buildWhatsAppUrl(formData.whatsapp, message);
      createMutation.mutate({ ...formData, sent: { name: formData.name, phone, url, message } });
    } catch (err: unknown) {
      toast.error(err instanceof Error && err.message ? err.message : "Erro ao criar link do WhatsApp");
    }
  };

  const copyMessage = async () => {
    if (!sentInvite) return;
    try {
      await navigator.clipboard.writeText(sentInvite.message);
      setCopied(true);
      toast.success("Mensagem copiada. Cole no WhatsApp!");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  if (sentInvite) {
    return (
      <div className="space-y-6 max-w-lg">
        <h1 className="text-2xl font-display font-bold">Convidar Visitante</h1>
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <p className="font-medium">
              Convite criado para {sentInvite.name || "o visitante"} ({sentInvite.phone}).
            </p>
            <p className="text-sm text-muted-foreground">
              Abra o WhatsApp e envie a mensagem abaixo. O texto já vem pronto.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full font-bold uppercase tracking-wider min-h-[48px]">
                <a href={sentInvite.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir WhatsApp
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={copyMessage} className="w-full min-h-[48px]">
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Mensagem copiada" : "Copiar mensagem"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground break-words border border-border rounded-md p-3 bg-muted">
              {sentInvite.message}
            </p>
            <p className="text-xs text-muted-foreground">
              Se o WhatsApp não abrir neste aparelho, copie a mensagem e envie de outro dispositivo com o
              WhatsApp instalado e ativo.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setSentInvite(null)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Criar outro convite
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
            {FORM_FIELDS.map(({ key, label, type, required, placeholder }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type={type || "text"}
                  value={formData[key]}
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
