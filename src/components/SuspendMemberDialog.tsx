import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Ban, RotateCcw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  /** "suspend" shows the reason field; "reactivate" confirms restoring access. */
  mode: "suspend" | "reactivate";
  /** Absences in the current semester, shown as context when suspending. */
  absences?: number;
}

// Query keys that show member lists / status and should refresh after a change.
const AFFECTED_QUERY_KEYS = [
  ["members-list"],
  ["admin-users"],
  ["superadmin-users"],
  ["attendance-semester-members"],
  ["profile-permissions"],
];

export const SuspendMemberDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  memberId,
  memberName,
  mode,
  absences,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "suspend") {
        const { error } = await supabase
          .from("profiles")
          .update({
            status: "suspended",
            suspended_at: new Date().toISOString(),
            suspended_by: user?.id ?? null,
            suspension_reason: reason.trim() || null,
          })
          .eq("id", memberId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .update({
            status: "active",
            suspended_at: null,
            suspended_by: null,
            suspension_reason: null,
          })
          .eq("id", memberId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        mode === "suspend"
          ? `${memberName} foi suspenso(a).`
          : `${memberName} foi reativado(a).`
      );
      AFFECTED_QUERY_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key })
      );
      onOpenChange(false);
      setReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "suspend" ? (
              <Ban className="h-5 w-5 text-destructive" />
            ) : (
              <RotateCcw className="h-5 w-5 text-success" />
            )}
            {mode === "suspend" ? "Suspender" : "Reativar"} {memberName}
          </DialogTitle>
          <DialogDescription>
            {mode === "suspend"
              ? "O membro perde o acesso ao app até ser reativado. Ele verá uma tela informando a suspensão."
              : "O membro volta a ter acesso normal ao app."}
          </DialogDescription>
        </DialogHeader>

        {mode === "suspend" && (
          <div className="space-y-3">
            {typeof absences === "number" && absences >= 3 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <span className="font-semibold text-destructive">
                  {absences} faltas
                </span>{" "}
                no semestre — acima do limite de 3 previsto no Termo de Compromisso.
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="suspension-reason" className="text-sm font-semibold">
                Motivo (exibido ao membro)
              </Label>
              <Textarea
                id="suspension-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: Excedeu o limite de 3 faltas no semestre."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant={mode === "suspend" ? "destructive" : "default"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full"
          >
            {mutation.isPending
              ? "Processando..."
              : mode === "suspend"
              ? "Confirmar Suspensão"
              : "Confirmar Reativação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
