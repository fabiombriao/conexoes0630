import React from "react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Clock } from "lucide-react";
import { toast } from "sonner";

const PendingApprovalPage: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

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
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-display font-bold">Aguardando Aprovação</h2>
          <p className="text-muted-foreground">
            Sua solicitação foi enviada! Aguarde a aprovação do administrador para acessar o sistema.
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut} className="border-border">
          Sair
        </Button>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
