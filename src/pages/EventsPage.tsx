import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar, Plus, MapPin, Heart } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useGroupId } from "@/hooks/useGroupId";

const EVENT_TYPE_LABELS: Record<string, string> = {
  weekly_meeting: "Apresentação do Mês",
  regional_event: "Evento Regional",
  training: "Treinamento",
  guest_day: "Dia do Convidado",
  business_round: "Rodada de Negócios",
};

const EventsPage: React.FC = () => {
  const { user } = useAuth();
  const { groupId } = useGroupId();
  const queryClient = useQueryClient();
  const { isSuperAdmin, can } = usePermissions();
  const canCreateEvents = isSuperAdmin || can("create_events");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: events, isLoading } = useQuery({
    queryKey: ["events", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("group_id", groupId)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  // Fetch user's registrations from DB
  const { data: registrations } = useQuery({
    queryKey: ["event-registrations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("event_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set(data.map((r) => r.event_id));
    },
    enabled: !!user,
  });

  const registerMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("event_registrations")
        .insert({ event_id: eventId, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations"] });
      toast.success("Interesse registrado!");
    },
    onError: () => toast.error("Erro ao registrar interesse"),
  });

  const unregisterMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("event_registrations")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations"] });
      toast.success("Interesse removido");
    },
    onError: () => toast.error("Erro ao remover interesse"),
  });

  const toggleInterest = (eventId: string) => {
    if (registrations?.has(eventId)) {
      unregisterMutation.mutate(eventId);
    } else {
      registerMutation.mutate(eventId);
    }
  };

  const createEventMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").insert({
        title: formData.title,
        event_date: formData.event_date,
        event_type: formData.event_type || "weekly_meeting",
        location: formData.location,
        description: formData.description,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        group_id: groupId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setDialogOpen(false);
      setFormData({});
      toast.success("Evento criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const presentations = events?.filter((e) => e.event_type === "weekly_meeting") ?? [];
  const otherEvents = events?.filter((e) => e.event_type !== "weekly_meeting") ?? [];

  const renderEventCard = (event: any) => {
    const d = new Date(event.event_date);
    const isInterested = registrations?.has(event.id) ?? false;
    return (
      <Card key={event.id} className="bg-card border-border card-hover-border">
        <CardContent className="p-0 flex">
          <div className="w-16 shrink-0 bg-primary flex flex-col items-center justify-center text-primary-foreground rounded-l-lg p-2">
            <span className="text-xl font-display font-bold">{d.getDate()}</span>
            <span className="text-xs uppercase">{d.toLocaleDateString("pt-BR", { month: "short" })}</span>
          </div>
          <div className="flex-1 p-3 flex flex-col gap-1">
            <p className="font-medium text-sm">{event.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {event.location}
                </span>
              )}
            </div>
            {event.description && <p className="text-xs text-muted-foreground mt-1">{event.description}</p>}
            <Button
              size="sm"
              variant={isInterested ? "default" : "outline"}
              className="mt-2 self-start border-border text-xs"
              onClick={() => toggleInterest(event.id)}
              disabled={registerMutation.isPending || unregisterMutation.isPending}
            >
              <Heart className={`h-3 w-3 mr-1 ${isInterested ? "fill-current" : ""}`} />
              {isInterested ? "Interessado" : "Tenho Interesse"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Eventos</h1>
        {canCreateEvents && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-bold uppercase tracking-wider">
                <Plus className="h-4 w-4 mr-2" /> Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-popover border-border">
              <DialogHeader><DialogTitle className="font-display">Novo Evento</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createEventMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={formData.title || ""} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} className="bg-muted border-border" required />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <select value={formData.event_type || "weekly_meeting"} onChange={(e) => setFormData((p) => ({ ...p, event_type: e.target.value }))} className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm">
                    <option value="weekly_meeting">Apresentação do Mês</option>
                    <option value="regional_event">Evento Regional</option>
                    <option value="training">Treinamento</option>
                    <option value="guest_day">Dia do Convidado</option>
                    <option value="business_round">Rodada de Negócios</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Data e hora</Label>
                  <Input type="datetime-local" value={formData.event_date || ""} onChange={(e) => setFormData((p) => ({ ...p, event_date: e.target.value }))} className="bg-muted border-border" required />
                </div>
                <div className="space-y-2">
                  <Label>Local</Label>
                  <Input value={formData.location || ""} onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))} className="bg-muted border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={formData.description || ""} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} className="bg-muted border-border" />
                </div>
                <Button type="submit" className="w-full font-bold uppercase tracking-wider" disabled={createEventMutation.isPending}>
                  Criar Evento
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg">Apresentações do Mês</h2>
            {presentations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma apresentação agendada</p>
            ) : (
              presentations.map(renderEventCard)
            )}
          </div>
          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg">Outros Eventos</h2>
            {otherEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum outro evento agendado</p>
            ) : (
              otherEvents.map(renderEventCard)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
