import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { IDEA_KEYS } from "@/hooks/useIdeas";
import {
  ORIGIN_LABELS,
  PRIORITY_LABELS,
  positionBetween,
  type IdeaOrigin,
  type IdeaPriority,
  type IdeaRow,
  type IdeaStage,
} from "@/lib/ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  defaultStageId: string | null;
  stages: IdeaStage[];
  ideas: IdeaRow[];
  onClose: () => void;
  onCreated: (ideaId: string) => void;
}

export const NewIdeaDialog: React.FC<Props> = ({ open, defaultStageId, stages, ideas, onClose, onCreated }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [origin, setOrigin] = useState<IdeaOrigin>("app");
  const [priority, setPriority] = useState<IdeaPriority>("medium");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setOrigin("app");
    setPriority("medium");
    setStageId(defaultStageId ?? stages[0]?.id ?? "");
    // só reinicia o formulário quando o diálogo abre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      const inStage = ideas.filter((i) => i.stage_id === stageId).map((i) => i.position);
      const firstPos = inStage.length ? Math.min(...inStage) : null;
      const { data, error } = await supabase
        .from("ideas")
        .insert({
          stage_id: stageId,
          title: title.trim(),
          description: description.trim() || null,
          origin,
          priority,
          position: positionBetween(null, firstPos),
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: IDEA_KEYS.root });
      toast.success("Ideia criada!");
      onClose();
      onCreated(id);
    },
    onError: () => toast.error("Não foi possível criar a ideia."),
  });

  const canSave = title.trim().length > 0 && stageId !== "" && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova ideia</DialogTitle>
          <DialogDescription>O resto (valores, tarefas, anexos) você completa abrindo a ideia depois.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="idea-title">Título</Label>
            <Input id="idea-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idea-desc">Descrição</Label>
            <Textarea id="idea-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as IdeaPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select value={origin} onValueChange={(v) => setOrigin(v as IdeaOrigin)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ORIGIN_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSave}>
              {create.isPending ? "Criando..." : "Criar ideia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
