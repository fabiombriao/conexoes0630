import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";

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
  { key: "canControlAttendance", label: "Controle de Presença", desc: "Pode abrir e enviar listas de presença para aprovação" },
  { key: "canCreateEvents", label: "Criar Eventos", desc: "Pode criar, editar e excluir eventos na agenda" },
  { key: "canViewReports", label: "Visualizar Relatórios", desc: "Acesso aos relatórios TIM de todos os membros" },
  { key: "canManageProfiles", label: "Gerenciar Perfis", desc: "Pode editar dados de perfil de membros" },
  { key: "canSendAnnouncements", label: "Enviar Avisos", desc: "Pode enviar notificações e avisos ao grupo" },
  { key: "canViewInvitations", label: "Ver Indicações Realizadas", desc: "Acesso ao menu de indicações de visitantes" },
];

// Map new JSON keys to the old hook keys for display
const PERM_LABEL_MAP: Record<string, string> = {
  canControlAttendance: "Presença",
  canCreateEvents: "Eventos",
  canViewReports: "Relatórios",
  canManageProfiles: "Perfis",
  canSendAnnouncements: "Avisos",
  canViewInvitations: "Indicações",
};

interface AdminRow {
  id: string;
  full_name: string | null;
  admin_permissions: AdminPermissionsData | null;
  email?: string;
}

export default function ManageAdminsPage() {
  const { isSuperAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminRow | null>(null);

  // Form state for create
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPerms, setNewPerms] = useState<AdminPermissionsData>({ ...DEFAULT_PERMS });

  // Form state for edit
  const [editPerms, setEditPerms] = useState<AdminPermissionsData>({ ...DEFAULT_PERMS });

  // Fetch admins: users with group_leader role
  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "group_leader");
      if (rolesErr) throw rolesErr;
      if (!roles?.length) return [];

      const ids = roles.map((r) => r.user_id);
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, admin_permissions")
        .in("id", ids);
      if (profErr) throw profErr;
      return (profiles ?? []) as unknown as AdminRow[];
    },
    enabled: isSuperAdmin,
  });

  // Create admin via edge function (needs service role to create user)
  const createAdminMutation = useMutation({
    mutationFn: async () => {
      // 1. Sign up the user via supabase auth admin (we use an edge function)
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { full_name: newName } },
      });
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Falha ao criar usuário");

      // 2. Update profile status to active + set permissions
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          status: "active",
          full_name: newName,
          admin_permissions: newPerms as unknown as null,
        })
        .eq("id", userId);
      if (profErr) throw profErr;

      // 3. Add group_leader role
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "group_leader" });
      if (roleErr) throw roleErr;
    },
    onSuccess: () => {
      toast.success("Admin criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      resetCreateForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePermsMutation = useMutation({
    mutationFn: async () => {
      if (!editAdmin) return;
      const { error } = await supabase
        .from("profiles")
        .update({ admin_permissions: editPerms as unknown as null })
        .eq("id", editAdmin.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditAdmin(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Change role from group_leader to member
      const { error } = await supabase
        .from("user_roles")
        .update({ role: "member" })
        .eq("user_id", userId)
        .eq("role", "group_leader");
      if (error) throw error;
      // Clear admin_permissions
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ admin_permissions: null })
        .eq("id", userId);
      if (profErr) throw profErr;
    },
    onSuccess: () => {
      toast.success("Admin removido. Usuário agora é membro.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditAdmin(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetCreateForm = () => {
    setCreateOpen(false);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewPerms({ ...DEFAULT_PERMS });
  };

  const openEdit = (admin: AdminRow) => {
    setEditAdmin(admin);
    setEditPerms({ ...DEFAULT_PERMS, ...(admin.admin_permissions ?? {}) });
  };

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const activePerms = (perms: AdminPermissionsData | null) =>
    PERM_META.filter((p) => perms?.[p.key]).map((p) => PERM_LABEL_MAP[p.key]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Gerenciar Admins</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Criar Admin
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum admin cadastrado ainda.</div>
      ) : (
        <div className="grid gap-4">
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => openEdit(admin)}
            >
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{admin.full_name || "Sem nome"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {activePerms(admin.admin_permissions).length > 0 ? (
                    activePerms(admin.admin_permissions).map((label) => (
                      <Badge key={label} className="bg-primary/20 text-primary border-primary/30 text-xs">
                        {label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Nenhuma permissão ativa</span>
                  )}
                </div>
              </div>
              <Pencil className="h-5 w-5 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      {/* Create Admin Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); else setCreateOpen(true); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Admin</DialogTitle>
            <DialogDescription>Cadastre um novo administrador com permissões personalizadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do admin" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha temporária</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-1">
              <Label className="text-base font-semibold">Permissões</Label>
              <div className="space-y-3 pt-2">
                {PERM_META.map((p) => (
                  <div key={p.key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                    </div>
                    <Switch
                      checked={newPerms[p.key]}
                      onCheckedChange={(val) => setNewPerms((prev) => ({ ...prev, [p.key]: val }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createAdminMutation.mutate()}
              disabled={!newName || !newEmail || !newPassword || createAdminMutation.isPending}
              className="w-full"
            >
              {createAdminMutation.isPending ? "Criando..." : "Criar Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Admin Dialog */}
      <Dialog open={!!editAdmin} onOpenChange={(open) => { if (!open) setEditAdmin(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Admin</DialogTitle>
            <DialogDescription>{editAdmin?.full_name || "Admin"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-base font-semibold">Permissões</Label>
            <div className="space-y-3 pt-2">
              {PERM_META.map((p) => (
                <div key={p.key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                  <Switch
                    checked={editPerms[p.key]}
                    onCheckedChange={(val) => setEditPerms((prev) => ({ ...prev, [p.key]: val }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => updatePermsMutation.mutate()}
              disabled={updatePermsMutation.isPending}
              className="w-full"
            >
              {updatePermsMutation.isPending ? "Salvando..." : "Salvar Permissões"}
            </Button>
            <Button
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => editAdmin && removeAdminMutation.mutate(editAdmin.id)}
              disabled={removeAdminMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {removeAdminMutation.isPending ? "Removendo..." : "Remover Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
