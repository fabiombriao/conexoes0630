import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, Megaphone, FileText, AlertTriangle } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useLocation, useNavigate } from "react-router-dom";
import BroadcastNotificationDialog from "@/components/BroadcastNotificationDialog";
import { useTermCommitment } from "@/hooks/useTermCommitment";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  contribution_id: string | null;
  read: boolean | null;
  created_at: string;
};

type ReferralContributionRow = {
  id: string;
  user_id: string;
  contribution_date: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  referral_category: string | null;
  temperature: string | null;
  referral_action: string | null;
  referral_description: string | null;
  notes: string | null;
  referred_to: string | null;
  referral_status: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

const REFERRAL_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  new: {
    label: "Nova",
    className: "bg-primary/15 text-primary border-primary/25",
  },
  pending: {
    label: "Em andamento",
    className: "bg-warning/15 text-warning border-warning/25",
  },
  closed_won: {
    label: "Fechada",
    className: "bg-success/15 text-success border-success/25",
  },
  closed_lost: {
    label: "Perdida",
    className: "bg-destructive/15 text-destructive border-destructive/25",
  },
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isReferralNotification = (notification: NotificationRow) => {
  const contributionId = getNotificationContributionId(notification);
  return (
    REFERRAL_NOTIFICATION_TYPES.has(notification.type) ||
    Boolean(contributionId)
  );
};

const extractReferralContactName = (message: string) => {
  const match = message.match(/:\s*(.+)\s*$/);
  return match?.[1]?.trim() || null;
};

const extractReferralIdentifiers = (message: string) => {
  const normalized = normalizeText(message);
  const match = normalized.match(
    /^(.*?) fez uma indicacao para voce:? ?(.+)?$/,
  );
  return {
    senderName: match?.[1]?.trim() || null,
    contactName: match?.[2]?.trim() || extractReferralContactName(message),
  };
};

const CONTRIBUTION_QUERY_KEYS = [
  "contribution_id",
  "contributionId",
  "referralId",
] as const;

const getContributionIdFromSearch = (search: string) => {
  const params = new URLSearchParams(search);
  for (const key of CONTRIBUTION_QUERY_KEYS) {
    const value = params.get(key);
    if (value) return value;
  }

  return null;
};

const getContributionIdFromLink = (link: string | null) => {
  if (!link) return null;

  try {
    return getContributionIdFromSearch(
      new URL(link, window.location.origin).search,
    );
  } catch {
    return null;
  }
};

const getNotificationContributionId = (
  notification: NotificationRow | null,
) => {
  if (!notification) return null;

  return (
    notification.contribution_id || getContributionIdFromLink(notification.link)
  );
};

const REFERRAL_NOTIFICATION_TYPES = new Set(["indicacao", "referral_accepted"]);

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { isSuperAdmin, can } = usePermissions();
  const { needsSignature } = useTermCommitment();
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [referralPreviewOpen, setReferralPreviewOpen] = useState(false);
  const [activeReferralNotification, setActiveReferralNotification] =
    useState<NotificationRow | null>(null);

  const canSendAnnouncements = isSuperAdmin || can("send_announcements");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, user_id, title, message, type, link, contribution_id, read, created_at",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NotificationRow[];
    },
    enabled: !!user,
  });

  const { data: receivedReferrals = [], isLoading: receivedReferralsLoading } =
    useQuery<ReferralContributionRow[]>({
      queryKey: ["received-referrals", user?.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("contributions")
          .select(
            "id, user_id, contribution_date, contact_name, contact_phone, contact_email, referral_category, temperature, referral_action, referral_description, notes, referred_to, referral_status, created_at",
          )
          .eq("type", "referral")
          .eq("referred_to", user!.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data as ReferralContributionRow[];
      },
      enabled: !!user,
    });

  const contributionIdParam = useMemo(() => {
    return getContributionIdFromSearch(location.search);
  }, [location.search]);

  const { data: senderProfiles = [] } = useQuery<ProfileRow[]>({
    queryKey: [
      "received-referral-senders",
      user?.id,
      receivedReferrals
        .map((referral) => referral.user_id)
        .sort()
        .join(","),
    ],
    queryFn: async () => {
      const senderIds = Array.from(
        new Set(receivedReferrals.map((referral) => referral.user_id)),
      ).filter(Boolean);
      if (senderIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);
      if (error) throw error;
      return (data || []) as ProfileRow[];
    },
    enabled: !!user && receivedReferrals.length > 0,
  });

  const senderNameMap = useMemo(
    () =>
      new Map(
        senderProfiles.map((profile) => [profile.id, profile.full_name || ""]),
      ),
    [senderProfiles],
  );

  const getReferralSenderLabel = (
    notification: NotificationRow | null,
    referral: ReferralContributionRow | null = null,
  ) => {
    const profileName = referral
      ? senderNameMap.get(referral.user_id)?.trim()
      : "";
    if (profileName) return profileName;

    if (notification) {
      const extractedName = extractReferralIdentifiers(
        notification.message,
      ).senderName;
      if (extractedName) return extractedName;
    }

    return "Membro removido";
  };

  const markReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notifId);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const acceptReferralMutation = useMutation({
    mutationFn: async (contributionId: string) => {
      const { error } = await supabase.rpc("accept_referral_contribution", {
        _contribution_id: contributionId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["unread-notifications-count"],
      });
      queryClient.invalidateQueries({ queryKey: ["received-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-rankings"] });
      if (contributionIdParam) {
        navigate("/notifications", { replace: true });
      }
      setReferralPreviewOpen(false);
      setActiveReferralNotification(null);
      toast.success("Indicação aceita");
    },
    onError: (e: any) =>
      toast.error(e.message || "Erro ao aceitar a indicação"),
  });

  const activeReferral = useMemo(() => {
    const stableContributionId =
      contributionIdParam ||
      getNotificationContributionId(activeReferralNotification);

    if (stableContributionId) {
      return (
        receivedReferrals.find(
          (referral) => referral.id === stableContributionId,
        ) || null
      );
    }

    if (!activeReferralNotification) {
      return receivedReferrals.length === 1 ? receivedReferrals[0] : null;
    }

    const identifiers = extractReferralIdentifiers(
      activeReferralNotification.message,
    );
    const candidates = receivedReferrals.filter((referral) => {
      const senderName = senderNameMap.get(referral.user_id)?.trim() || "";
      const senderMatches = identifiers.senderName
        ? !senderName ||
          normalizeText(senderName) === normalizeText(identifiers.senderName)
        : true;
      const contactMatches = identifiers.contactName
        ? normalizeText(referral.contact_name || "") ===
          normalizeText(identifiers.contactName)
        : true;
      return senderMatches && contactMatches;
    });

    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      const notificationTime = new Date(
        activeReferralNotification.created_at,
      ).getTime();
      return [...candidates].sort((a, b) => {
        const aTime = Math.abs(
          new Date(a.created_at).getTime() - notificationTime,
        );
        const bTime = Math.abs(
          new Date(b.created_at).getTime() - notificationTime,
        );
        return aTime - bTime;
      })[0];
    }

    return receivedReferrals.length === 1 ? receivedReferrals[0] : null;
  }, [
    activeReferralNotification,
    contributionIdParam,
    receivedReferrals,
    senderNameMap,
  ]);

  const activeReferralSourceNotification = useMemo(() => {
    const stableContributionId =
      contributionIdParam ||
      activeReferral?.id ||
      getNotificationContributionId(activeReferralNotification);

    if (stableContributionId) {
      return (
        notifications?.find(
          (notification) =>
            getNotificationContributionId(notification) ===
            stableContributionId,
        ) || activeReferralNotification || null
      );
    }

    return activeReferralNotification;
  }, [
    activeReferral?.id,
    activeReferralNotification,
    contributionIdParam,
    notifications,
  ]);

  useEffect(() => {
    if (contributionIdParam) {
      setReferralPreviewOpen(true);
    }
  }, [contributionIdParam]);

  const handleNotificationClick = (n: NotificationRow) => {
    if (!n.read) {
      markReadMutation.mutate(n.id);
    }
    const contributionId = getNotificationContributionId(n);

    if (isReferralNotification(n)) {
      if (contributionId) {
        navigate(`/notifications?contribution_id=${contributionId}`, {
          replace: true,
        });
      }
      setActiveReferralNotification(n);
      setReferralPreviewOpen(true);
      return;
    }
    if (n.link) {
      navigate(n.link);
    }
  };

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold">Notificações</h1>
        <div className="flex gap-2">
          {canSendAnnouncements && (
            <Button
              variant="default"
              size="sm"
              className="gap-1"
              onClick={() => setBroadcastOpen(true)}
            >
              <Megaphone className="h-4 w-4" />
              Enviar Aviso
            </Button>
          )}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => markAllReadMutation.mutate()}
            >
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
                <p className="font-medium">
                  Você precisa assinar o termo de compromisso
                </p>
                <p className="text-sm text-muted-foreground">
                  Abra a notificação do termo ou acesse diretamente a tela de
                  assinatura para liberar o restante do aplicativo.
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
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
              className={`border-border ${n.read ? "bg-card" : "bg-muted"} ${n.link || isReferralNotification(n) ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
              onClick={() => handleNotificationClick(n)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {!n.read && (
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    {isReferralNotification(n) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Enviado por: {getReferralSenderLabel(n)}
                      </p>
                    )}
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

      <Dialog
        open={referralPreviewOpen}
        onOpenChange={(open) => {
          setReferralPreviewOpen(open);
          if (!open) {
            setActiveReferralNotification(null);
            if (contributionIdParam) {
              navigate("/notifications", { replace: true });
            }
          }
        }}
      >
        <DialogContent className="bg-popover border-border max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded">
                Indicação recebida
              </span>
              <span>Pré-visualização e aceite</span>
            </DialogTitle>
            <DialogDescription>
              Confira o conteúdo enviado pelo membro antes de aceitar a TRN.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {activeReferralSourceNotification && (
              <Card className="bg-muted/20 border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        {activeReferralSourceNotification.title}
                      </p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {activeReferralSourceNotification.message}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {new Date(
                        activeReferralSourceNotification.created_at,
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {isReferralNotification(activeReferralSourceNotification) && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Enviado por
                      </p>
                      <p className="text-sm">
                        {getReferralSenderLabel(
                          activeReferralSourceNotification,
                          activeReferral,
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {receivedReferralsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : activeReferral ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Enviado por</p>
                  <p className="text-sm">
                    {getReferralSenderLabel(
                      activeReferralSourceNotification,
                      activeReferral,
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {activeReferral.contact_name || "Contato sem nome"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(
                        activeReferral.contribution_date,
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {activeReferral.referral_status &&
                    REFERRAL_STATUS_META[activeReferral.referral_status] && (
                      <Badge
                        className={
                          REFERRAL_STATUS_META[activeReferral.referral_status]
                            .className
                        }
                      >
                        {
                          REFERRAL_STATUS_META[activeReferral.referral_status]
                            .label
                        }
                      </Badge>
                    )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Temperatura</p>
                    <p className="text-sm">
                      {activeReferral.temperature || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Categoria</p>
                    <p className="text-sm">
                      {activeReferral.referral_category || "—"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ação tomada</p>
                    <p className="text-sm">
                      {activeReferral.referral_action || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Contato recebido em
                    </p>
                    <p className="text-sm">
                      {new Date(
                        activeReferral.contribution_date,
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm">
                      {activeReferral.contact_phone || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="text-sm">
                      {activeReferral.contact_email || "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {activeReferral.referral_description || "—"}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {activeReferral.notes || "—"}
                  </p>
                </div>

                {activeReferral.referral_status === "new" ||
                !activeReferral.referral_status ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      className="font-semibold"
                      onClick={() =>
                        acceptReferralMutation.mutate(activeReferral.id)
                      }
                      disabled={acceptReferralMutation.isPending}
                    >
                      Aceitar indicação
                    </Button>
                    <Button
                      variant="outline"
                      className="border-border"
                      onClick={() =>
                        navigate("/contributions?focus=received-referrals")
                      }
                    >
                      Ver em Minhas TRN's
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="border-border"
                      onClick={() =>
                        navigate("/contributions?focus=received-referrals")
                      }
                    >
                      Ver em Minhas TRN's
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Card className="bg-muted/20 border-border">
                <CardContent className="p-4 space-y-3">
                  <p className="font-medium">
                    Não foi possível localizar esta indicação.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ela pode ainda não ter carregado no seu navegador. Abra a
                    lista de TRNs recebidas para visualizar e aceitar
                    manualmente.
                  </p>
                  <Button
                    variant="outline"
                    className="border-border"
                    onClick={() =>
                      navigate("/contributions?focus=received-referrals")
                    }
                  >
                    Abrir Minhas TRN's
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BroadcastNotificationDialog
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
      />
    </div>
  );
};

export default NotificationsPage;
