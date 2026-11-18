import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Flag, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IDEA_KEYS } from "@/hooks/useIdeas";
import type { IdeaRow, IdeaStage } from "@/lib/ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DEFAULT_COLORS = ["#64748b", "#3b82f6", "#a855f7", "#f97316", "#10b981", "#ef4444", "#eab308", "#06b6d4"];

const errorMessage = (e: unknown, fallback: string) => {
  const m = (e as { message?: string })?.message;
  return m && m.includes("Escolha outra etapa") ? m : fallback;
};

const StageRow: React.FC<{
  stage: IdeaStage;
  index: number;
  total: number;
  ideaCount: number;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onChanged: () => void;
}> = ({ stage, index, total, ideaCount, onMove, onDelete, onChanged }) => {
  const [name, setName] = useState(stage.name);

  const save = useMutation({
    mutationFn: async (patch: Partial<Pick<IdeaStage, "name" | "color" | "is_final" | "is_archived">>) => {
      const { error } = await supabase.from("idea_stages").update(patch).eq("id", stage.id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: () => {
      setName(stage.name);
      toast.error("Não foi possível salvar a etapa.");
    },
  });

  return (
    <li className={`rounded-lg border border-border p-2.5 ${stage.is_archived ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={stage.color}
          aria-label={`Cor da etapa ${stage.name}`}
          onChange={(e) => save.mutate({ color: e.target.value })}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
        />
        <Input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (!trimmed) setName(stage.name);
            else if (trimmed !== stage.name) save.mutate({ name: trimmed });
          }}
          className="h-9"
        />
        <div className="flex shrink-0">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={index === 0}
            aria-label="Mover para cima"
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={index === total - 1}
            aria-label="Mover para baixo"
            onClick={() => onMove(1)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{ideaCount} {ideaCount === 1 ? "ideia" : "ideias"}</span>
        <Button
          type="button"
          size="sm"
          variant={stage.is_final ? "secondary" : "ghost"}
          className="h-7 px-2 text-xs"
          onClick={() => save.mutate({ is_final: !stage.is_final })}
        >
          <Flag className="mr-1 h-3.5 w-3.5" /> {stage.is_final ? "Etapa final" : "Marcar como final"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => save.mutate({ is_archived: !stage.is_archived })}
        >
          {stage.is_archived ? (
            <>
              <ArchiveRestore className="mr-1 h-3.5 w-3.5" /> Reativar
            </>
          ) : (
            <>
              <Archive className="mr-1 h-3.5 w-3.5" /> Arquivar
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
        </Button>
      </div>
    </li>
  );
};

export const StageManagerDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  stages: IdeaStage[];
  ideas: IdeaRow[];
}> = ({ open, onClose, stages, ideas }) => {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [toDelete, setToDelete] = useState<IdeaStage | null>(null);
  const [destination, setDestination] = useState<string>("");

  const refresh = () => qc.invalidateQueries({ queryKey: IDEA_KEYS.root });
  const countIn = (stageId: string) => ideas.filter((i) => i.stage_id === stageId).length;

  const create = useMutation({
    mutationFn: async () => {
      const maxPos = stages.reduce((m, s) => Math.max(m, s.position), 0);
      const { error } = await supabase.from("idea_stages").insert({
        name: newName.trim(),
        color: DEFAULT_COLORS[stages.length % DEFAULT_COLORS.length],
        position: maxPos + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      refresh();
    },
    onError: () => toast.error("Não foi possível criar a etapa."),
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc("reorder_idea_stages", { _ids: ids });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível reordenar as etapas."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_idea_stage", {
        _stage_id: toDelete!.id,
        _move_to: countIn(toDelete!.id) > 0 ? destination : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa excluída.");
      setToDelete(null);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível excluir a etapa.")),
  });

  const move = (index: number, dir: -1 | 1) => {
    const ids = stages.map((s) => s.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  const askDelete = (stage: IdeaStage) => {
    setToDelete(stage);
    setDestination(stages.find((s) => s.id !== stage.id && !s.is_archived)?.id ?? "");
  };

  const toDeleteCount = toDelete ? countIn(toDelete.id) : 0;
  const otherStages = stages.filter((s) => s.id !== toDelete?.id);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Etapas do quadro</DialogTitle>
            <DialogDescription>
              A ordem daqui é a ordem das colunas. Etapa arquivada some do quadro, mas as ideias dela continuam guardadas.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) create.mutate();
            }}
          >
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova etapa" maxLength={40} />
            <Button type="submit" disabled={!newName.trim() || create.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Criar
            </Button>
          </form>

          <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
            {stages.map((s, i) => (
              <StageRow
                key={s.id}
                stage={s}
                index={i}
                total={stages.length}
                ideaCount={countIn(s.id)}
                onMove={(dir) => move(i, dir)}
                onDelete={() => askDelete(s)}
                onChanged={refresh}
              />
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a etapa "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDeleteCount > 0
                ? `Ela tem ${toDeleteCount} ${toDeleteCount === 1 ? "ideia" : "ideias"}. Escolha para qual etapa elas vão.`
                : "A etapa está vazia e será removida."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {toDeleteCount > 0 && (
            <div className="space-y-1.5">
              <Label>Mover as ideias para</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {otherStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.is_archived ? " (arquivada)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending || (toDeleteCount > 0 && !destination)}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "Excluindo..." : "Excluir etapa"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
