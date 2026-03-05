import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BroadcastNotificationDialog({ open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("broadcast_notification", {
        _type: "announcement",
        _title: title,
        _message: message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notificação enviada para todos os membros!");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setTitle("");
      setMessage("");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error("Erro ao enviar: " + err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Aviso</DialogTitle>
          <DialogDescription>Envie uma notificação para todos os membros ativos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reunião especial amanhã" />
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escreva a mensagem do aviso..." rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => broadcastMutation.mutate()}
            disabled={!title.trim() || !message.trim() || broadcastMutation.isPending}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {broadcastMutation.isPending ? "Enviando..." : "Enviar para Todos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
