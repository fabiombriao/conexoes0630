import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

interface AdminPermissionsData {
  canControlAttendance: boolean;
  canCreateEvents: boolean;
  canViewReports: boolean;
  canManageProfiles: boolean;
  canSendAnnouncements: boolean;
  canViewInvitations: boolean;
}

const DEFAULT_PERMS: AdminPermissionsData = {
  canControlAttendance: false,
  canCreateEvents: false,
  canViewReports: false,
  canManageProfiles: false,
  canSendAnnouncements: false,
  canViewInvitations: false,
};

const PERM_META: { key: keyof AdminPermissionsData; label: string; desc: string }[] = [
  { key: "canControlAttendance", label: "Controle de Presença", desc: "Pode abrir e enviar listas de presença" },
  { key: "canCreateEvents", label: "Criar Eventos", desc: "Pode criar, editar e excluir eventos" },
  { key: "canViewReports", label: "Visualizar Relatórios", desc: "Acesso aos relatórios TIN" },
  { key: "canManageProfiles", label: "Gerenciar Perfis", desc: "Pode editar perfis de membros" },
  { key: "canSendAnnouncements", label: "Enviar Avisos", desc: "Pode enviar notificações ao grupo" },
  { key: "canViewInvitations", label: "Ver Indicações", desc: "Acesso às indicações de visitantes" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
}

export const PromoteMemberDialog: React.FC<Props> = ({ open, onOpenChange, memberId, memberName }) => {
  const queryClient = useQueryClient();
  const [targetRole, setTargetRole] = useState<"group_leader" | "admin">("group_leader");
  const [perms, setPerms] = useState<AdminPermissionsData>({ ...DEFAULT_PERMS });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      // Update role
      const { error: roleErr } = await supabase
        .from("user_roles")
        .update({ role: targetRole })
        .eq("user_id", memberId);
      if (roleErr) throw roleErr;

      // Update profile permissions
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          admin_permissions: targetRole === "group_leader" ? (perms as unknown as null) : null,
        })
        .eq("id", memberId);
      if (profErr) throw profErr;
    },
    onSuccess: () => {
      toast.success(`${memberName} promovido com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["members-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-users"] });
      onOpenChange(false);
      setTargetRole("group_leader");
      setPerms({ ...DEFAULT_PERMS });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Promover {memberName}
          </DialogTitle>
          <DialogDescription>Escolha o cargo e as permissões para este membro.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-semibold">Cargo</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={targetRole === "group_leader" ? "default" : "outline"}
                onClick={() => setTargetRole("group_leader")}
                className="flex-1"
              >
                Admin
              </Button>
              <Button
                type="button"
                variant={targetRole === "admin" ? "default" : "outline"}
                onClick={() => setTargetRole("admin")}
                className="flex-1"
              >
                Super Admin
              </Button>
            </div>
          </div>

          {targetRole === "group_leader" && (
            <div className="space-y-1">
              <Label className="text-base font-semibold">Permissões</Label>
              <div className="space-y-3 pt-2">
                {PERM_META.map((p) => (
                  <div key={p.key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                    </div>
                    <Switch
                      checked={perms[p.key]}
                      onCheckedChange={(val) => setPerms((prev) => ({ ...prev, [p.key]: val }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {targetRole === "admin" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium text-primary">⚡ Acesso Total</p>
              <p className="text-xs text-muted-foreground mt-1">Super Admins têm acesso irrestrito a todas as funcionalidades.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => promoteMutation.mutate()}
            disabled={promoteMutation.isPending}
            className="w-full"
          >
            {promoteMutation.isPending ? "Promovendo..." : "Confirmar Promoção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
