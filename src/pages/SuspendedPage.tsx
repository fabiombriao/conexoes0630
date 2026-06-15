import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Ban } from "lucide-react";
import { toast } from "sonner";

const SuspendedPage: React.FC = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const { data: reason } = useQuery({
    queryKey: ["suspension-reason", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("suspension_reason")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data?.suspension_reason ?? null;
    },
    enabled: !!user,
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast.error("Erro ao sair: " + (error.message || "Tente novamente"));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <Logo size="lg" />
        <div className="space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-display font-bold">Acesso Suspenso</h2>
          <p className="text-muted-foreground">
            Seu acesso ao app foi temporariamente suspenso. Entre em contato com a
            administração do grupo para mais informações.
          </p>
          {reason && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Motivo
              </p>
              <p className="text-sm whitespace-pre-line">{reason}</p>
            </div>
          )}
        </div>
        <Button variant="outline" onClick={handleSignOut} className="border-border">
          Sair
        </Button>
      </div>
    </div>
  );
};

export default SuspendedPage;
