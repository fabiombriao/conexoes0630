import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { IDEA_KEYS } from "@/hooks/useIdeas";
import { removeStorageFiles, uploadIdeaFile } from "@/lib/ideaAttachments";
import type { IdeaAttachment, IdeaNote } from "@/lib/ideas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentList, StagedFiles } from "@/components/ideas/IdeaAttachments";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const IdeaNotesSection: React.FC<{
  ideaId: string;
  notes: IdeaNote[];
  attachments: IdeaAttachment[];
  nameOf: (id: string | null | undefined) => string;
}> = ({ ideaId, notes, attachments, nameOf }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const refresh = () => qc.invalidateQueries({ queryKey: IDEA_KEYS.root });

  const publish = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("idea_notes")
        .insert({ idea_id: ideaId, body: body.trim(), author_id: user!.id })
        .select("id")
        .single();
      if (error) throw error;
      let failed = 0;
      for (const f of files) {
        try {
          await uploadIdeaFile(f, { ideaId, noteId: data.id }, user!.id);
        } catch {
          failed++;
        }
      }
      return failed;
    },
    onSuccess: (failed) => {
      setBody("");
      setFiles([]);
      refresh();
      if (failed > 0) toast.error(`${failed} anexo(s) não puderam ser enviados. A observação foi salva.`);
    },
    onError: () => toast.error("Não foi possível salvar a observação."),
  });

  const remove = useMutation({
    mutationFn: async (note: IdeaNote) => {
      await removeStorageFiles(attachments.filter((a) => a.note_id === note.id).map((a) => a.file_path));
      const { error } = await supabase.from("idea_notes").delete().eq("id", note.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível excluir a observação."),
  });

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Observações</h3>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) publish.mutate();
        }}
      >
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva uma observação sobre esta ideia..."
        />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <StagedFiles files={files} onChange={setFiles} />
          <Button type="submit" size="sm" disabled={!body.trim() || publish.isPending}>
            {publish.isPending ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </form>

      {notes.length > 0 && (
        <ol className="relative ml-1.5 space-y-4 border-l border-border pl-4">
          {notes.map((n) => (
            <li key={n.id} className="relative">
              <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{nameOf(n.author_id) || "Alguém"}</strong> ·{" "}
                  {formatDateTime(n.created_at)}
                </p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="-mt-1.5 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Excluir observação"
                  onClick={() => {
                    if (window.confirm("Excluir esta observação?")) remove.mutate(n);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
              <div className="mt-1.5">
                <AttachmentList attachments={attachments.filter((a) => a.note_id === n.id)} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
