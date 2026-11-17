import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  describeGeolocationError,
  describeSelfCheckIn,
  SELF_CHECKIN_WINDOW_LABEL,
  todayInMeetingTimeZone,
  type SelfCheckInResult,
} from "@/lib/selfCheckIn";

class GeolocationFailure extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

const getCurrentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new GeolocationFailure("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new GeolocationFailure(err.message, err.code)), {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });

const SelfCheckInCard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = todayInMeetingTimeZone();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: checkin, isLoading } = useQuery({
    queryKey: ["my-self-checkin", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_self_checkins")
        .select("checked_in_at, distance_m")
        .eq("member_id", user!.id)
        .eq("session_date", today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const position = await getCurrentPosition();
      const { data, error } = await supabase.rpc("confirm_self_attendance", {
        _latitude: position.coords.latitude,
        _longitude: position.coords.longitude,
        _accuracy: position.coords.accuracy,
      });
      if (error) throw error;
      return data as unknown as SelfCheckInResult;
    },
    onSuccess: (result) => {
      const { ok, message } = describeSelfCheckIn(result);
      if (ok) {
        setErrorMessage(null);
        toast.success(message);
        queryClient.invalidateQueries({ queryKey: ["my-self-checkin"] });
        queryClient.invalidateQueries({ queryKey: ["self-checkins"] });
      } else {
        setErrorMessage(message);
      }
    },
    onError: (e: unknown) => {
      if (e instanceof GeolocationFailure) {
        setErrorMessage(describeGeolocationError(e.code));
      } else {
        setErrorMessage((e as Error)?.message || "Erro ao confirmar presença. Tente novamente.");
      }
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (checkin) {
    const time = new Date(checkin.checked_in_at).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    return (
      <Card className="bg-card border-success/40">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
          <div>
            <p className="font-display font-bold">Presença de hoje confirmada</p>
            <p className="text-sm text-muted-foreground">Registrada às {time}.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 text-primary shrink-0" />
            <div>
              <p className="font-display font-bold">Confirmar minha presença</p>
              <p className="text-sm text-muted-foreground">
                Disponível às {SELF_CHECKIN_WINDOW_LABEL}, apenas para quem estiver no local da reunião (até 100 m).
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              setErrorMessage(null);
              confirmMutation.mutate();
            }}
            disabled={confirmMutation.isPending}
            className="font-bold uppercase tracking-wider"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando localização...
              </>
            ) : (
              "Confirmar presença"
            )}
          </Button>
        </div>
        {errorMessage && (
          <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
            {errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SelfCheckInCard;
