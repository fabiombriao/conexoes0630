import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, Megaphone, FileText, AlertTriangle } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import BroadcastNotificationDialog from "@/components/BroadcastNotificationDialog";
import { useTermCommitment } from "@/hooks/useTermCommitment";

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean | null;
  created_at: string;
};

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isSuperAdmin, can } = usePermissions();
  const { needsSignature } = useTermCommitment();
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const canSendAnnouncements = isSuperAdmin || can("send_announcements");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NotificationRow[];
    },
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notifId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleNotificationClick = (n: NotificationRow) => {
    if (!n.read) {
      markReadMutation.mutate(n.id);
    }
    if (n.link) {
      navigate(n.link);
    }
  };

  const unreadCount = notifications?.filter(n => !n.read).length ?? 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold">Notificações</h1>
        <div className="flex gap-2">
          {canSendAnnouncements && (
            <Button variant="default" size="sm" className="gap-1" onClick={() => setBroadcastOpen(true)}>
              <Megaphone className="h-4 w-4" />
              Enviar Aviso
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="border-border" onClick={() => markAllReadMutation.mutate()}>
              <Check className="h-4 w-4 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
      </div>

      {needsSignature && (
        <Card className="border-border bg-warning/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Você precisa assinar o termo de compromisso</p>
                <p className="text-sm text-muted-foreground">
                  Abra a notificação do termo ou acesse diretamente a tela de assinatura para liberar o restante do aplicativo.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-border gap-2"
                  onClick={() => navigate("/termo-compromisso")}
                >
                  <FileText className="h-4 w-4" />
                  Ir para o termo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : !notifications || notifications.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 text-primary" />
            <p>Nenhuma notificação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`border-border ${n.read ? "bg-card" : "bg-muted"} ${n.link ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
              onClick={() => handleNotificationClick(n)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {!n.read && <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BroadcastNotificationDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
    </div>
  );
};

export default NotificationsPage;
