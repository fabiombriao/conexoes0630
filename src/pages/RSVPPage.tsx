import React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import { Check, Calendar, MapPin } from "lucide-react";

const RSVPPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const { data: invitation, isLoading } = useQuery({
    queryKey: ["rsvp", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitor_invitations")
        .select("*")
        .eq("invite_token", token!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("visitor_invitations")
        .update({ status: "confirmed" as any })
        .eq("invite_token", token!);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Presença confirmada!"),
    onError: () => toast.error("Erro ao confirmar"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <Logo size="lg" />
          <p className="text-muted-foreground">Convite não encontrado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full bg-card border-primary border-2">
        <CardContent className="p-8 text-center space-y-6">
          <Logo size="lg" />
          <div className="space-y-2">
            <h2 className="font-display font-bold text-xl">Olá, {invitation.visitor_name}!</h2>
            <p className="text-muted-foreground">Você foi convidado para nosso evento de networking.</p>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-primary" />
              {new Date(invitation.event_date).toLocaleDateString("pt-BR")}
            </span>
          </div>
          {invitation.status === "confirmed" ? (
            <div className="flex items-center justify-center gap-2 text-success font-bold">
              <Check className="h-5 w-5" />
              Presença Confirmada!
            </div>
          ) : (
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="w-full font-bold uppercase tracking-wider orange-glow text-lg py-6"
            >
              Confirmar Presença
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RSVPPage;
