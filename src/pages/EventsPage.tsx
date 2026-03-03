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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar, Plus, MapPin } from "lucide-react";

const EVENT_TYPE_LABELS: Record<string, string> = {
  weekly_meeting: "Reunião Semanal",
  regional_event: "Evento Regional",
  training: "Treinamento",
  guest_day: "Dia do Convidado",
  business_round: "Rodada de Negócios",
};

const EventsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: events, isLoading } = useQuery({
    queryKey: ["events", user?.id],
    queryFn: async () => {
      const { data: membership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!membership?.group_id) return [];

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("group_id", membership.group_id)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const registerMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("event_registrations").insert({
        event_id: eventId,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscrito com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao se inscrever"),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Eventos</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !events || events.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-primary" />
            <p className="text-lg">Nenhum evento agendado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const d = new Date(event.event_date);
            return (
              <Card key={event.id} className="bg-card border-border card-hover-border">
                <CardContent className="p-0 flex">
                  <div className="w-20 shrink-0 bg-primary flex flex-col items-center justify-center text-primary-foreground rounded-l-lg p-3">
                    <span className="text-2xl font-display font-bold">{d.getDate()}</span>
                    <span className="text-xs uppercase">
                      {d.toLocaleDateString("pt-BR", { month: "short" })}
                    </span>
                  </div>
                  <div className="flex-1 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{event.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="font-bold uppercase tracking-wider shrink-0"
                      onClick={() => registerMutation.mutate(event.id)}
                    >
                      Inscrever
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventsPage;
