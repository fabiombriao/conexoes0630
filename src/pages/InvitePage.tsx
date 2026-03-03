import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Copy, Check } from "lucide-react";

const InvitePage: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ name: "", email: "", whatsapp: "", profession: "", event_date: "" });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: membership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!membership?.group_id) throw new Error("Você precisa estar em um grupo");

      const { data, error } = await supabase.from("visitor_invitations").insert({
        group_id: membership.group_id,
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
    onSuccess: (data) => {
      const link = `${window.location.origin}/rsvp/${data.invite_token}`;
      setInviteLink(link);
      toast.success("Convite criado!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar convite"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const handleCopy = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-display font-bold">Convidar Visitante</h1>

      {inviteLink ? (
        <Card className="bg-card border-primary border-2">
          <CardHeader><CardTitle className="font-display text-lg text-primary">Convite Criado!</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Compartilhe o link abaixo com seu visitante:</p>
            <div className="flex items-center gap-2">
              <Input value={inviteLink} readOnly className="bg-muted border-border text-sm" />
              <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0 border-border">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="outline" className="w-full border-border" onClick={() => { setInviteLink(null); setFormData({ name: "", email: "", whatsapp: "", profession: "", event_date: "" }); }}>
              Criar Outro Convite
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { key: "name", label: "Nome do visitante", required: true },
                { key: "email", label: "Email", type: "email" },
                { key: "whatsapp", label: "WhatsApp" },
                { key: "profession", label: "Profissão" },
                { key: "event_date", label: "Data do evento", type: "date", required: true },
              ].map(({ key, label, type, required }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type={type || "text"}
                    value={(formData as any)[key]}
                    onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                    className="bg-muted border-border"
                    required={required}
                  />
                </div>
              ))}
              <Button type="submit" className="w-full font-bold uppercase tracking-wider" disabled={createMutation.isPending}>
                <UserPlus className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Criando..." : "Criar Convite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InvitePage;
