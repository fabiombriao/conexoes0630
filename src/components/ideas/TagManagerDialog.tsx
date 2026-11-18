import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IDEA_KEYS } from "@/hooks/useIdeas";
import type { IdeaTag } from "@/lib/ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DEFAULT_COLORS = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#ef4444", "#eab308", "#06b6d4", "#ec4899"];

const TagRow: React.FC<{ tag: IdeaTag; onChanged: () => void }> = ({ tag, onChanged }) => {
  const [name, setName] = useState(tag.name);

  const save = useMutation({
    mutationFn: async (patch: Partial<Pick<IdeaTag, "name" | "color">>) => {
      const { error } = await supabase.from("idea_tags").update(patch).eq("id", tag.id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: (e: { code?: string }) => {
      setName(tag.name);
      toast.error(e?.code === "23505" ? "Já existe uma etiqueta com esse nome." : "Não foi possível salvar a etiqueta.");
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("idea_tags").delete().eq("id", tag.id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: () => toast.error("Não foi possível excluir a etiqueta."),
  });

  return (
    <li className="flex items-center gap-2">
      <input
        type="color"
        value={tag.color}
        aria-label={`Cor da etiqueta ${tag.name}`}
        onChange={(e) => save.mutate({ color: e.target.value })}
        className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
      />
      <Input
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (!trimmed) setName(tag.name);
          else if (trimmed !== tag.name) save.mutate({ name: trimmed });
        }}
        className="h-9"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Excluir etiqueta ${tag.name}`}
        onClick={() => {
          if (window.confirm(`Excluir a etiqueta "${tag.name}"? Ela será removida de todas as ideias.`)) remove.mutate();
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
};

export const TagManagerDialog: React.FC<{ open: boolean; onClose: () => void; tags: IdeaTag[] }> = ({
  open,
  onClose,
  tags,
}) => {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: IDEA_KEYS.root });

  const create = useMutation({
    mutationFn: async () => {
      const color = DEFAULT_COLORS[tags.length % DEFAULT_COLORS.length];
      const { error } = await supabase.from("idea_tags").insert({ name: newName.trim(), color });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      refresh();
    },
    onError: (e: { code?: string }) =>
      toast.error(e?.code === "23505" ? "Já existe uma etiqueta com esse nome." : "Não foi possível criar a etiqueta."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Etiquetas</DialogTitle>
          <DialogDescription>Crie, renomeie e escolha a cor. As etiquetas valem para todas as ideias.</DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) create.mutate();
          }}
        >
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova etiqueta" maxLength={40} />
          <Button type="submit" disabled={!newName.trim() || create.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Criar
          </Button>
        </form>

        {tags.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma etiqueta ainda.</p>
        ) : (
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {tags.map((t) => (
              <TagRow key={t.id} tag={t} onChanged={refresh} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};
