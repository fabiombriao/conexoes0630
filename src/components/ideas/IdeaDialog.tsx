import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IDEA_KEYS, useIdeaDetail, useIdeaList, type IdeaPerson } from "@/hooks/useIdeas";
import { removeStorageFiles } from "@/lib/ideaAttachments";
import {
  ORIGIN_LABELS,
  PRIORITY_LABELS,
  type IdeaOrigin,
  type IdeaPriority,
  type IdeaRow,
  type IdeaStage,
  type IdeaTag,
} from "@/lib/ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TagChip } from "@/components/ideas/IdeaBoardParts";
import { AttachButton, AttachmentList } from "@/components/ideas/IdeaAttachments";
import { IdeaTasksSection } from "@/components/ideas/IdeaTasksSection";
import { IdeaValuesSection } from "@/components/ideas/IdeaValuesSection";
import { IdeaNotesSection } from "@/components/ideas/IdeaNotesSection";

const NONE = "none";
const OTHER = "__other";

interface Props {
  ideaId: string;
  stages: IdeaStage[];
  tags: IdeaTag[];
  people: {
    members: IdeaPerson[];
    assignees: IdeaPerson[];
    nameOf: (id: string | null | undefined) => string;
  };
  onClose: () => void;
  onManageTags: () => void;
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const IdeaDialog: React.FC<Props> = ({ ideaId, stages, tags, people, onClose, onManageTags }) => {
  const qc = useQueryClient();
  const { data: ideas } = useIdeaList(true);
  const idea = ideas?.find((i) => i.id === ideaId);
  const detail = useIdeaDetail(ideaId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherMode, setOtherMode] = useState(false);

  // rascunhos locais (título/descrição/nome livre) recomeçam quando troca de ideia
  useEffect(() => {
    if (!idea) return;
    setTitle(idea.title);
    setDescription(idea.description ?? "");
    setOtherName(idea.suggested_by_name ?? "");
    setOtherMode(!idea.suggested_by_member_id && !!idea.suggested_by_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId]);

  const refresh = () => qc.invalidateQueries({ queryKey: IDEA_KEYS.root });

  const update = useMutation({
    mutationFn: async (patch: Partial<Omit<IdeaRow, "id">>) => {
      const { error } = await supabase.from("ideas").update(patch).eq("id", ideaId);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => {
      if (idea) {
        setTitle(idea.title);
        setDescription(idea.description ?? "");
      }
      toast.error("Não foi possível salvar a alteração.");
    },
  });

  const toggleTag = useMutation({
    mutationFn: async (tagId: string) => {
      const has = detail.data?.tagIds.includes(tagId);
      const { error } = has
        ? await supabase.from("idea_tag_links").delete().eq("idea_id", ideaId).eq("tag_id", tagId)
        : await supabase.from("idea_tag_links").insert({ idea_id: ideaId, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível alterar a etiqueta."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await removeStorageFiles((detail.data?.attachments ?? []).map((a) => a.file_path));
      const { error } = await supabase.from("ideas").delete().eq("id", ideaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ideia excluída.");
      onClose();
      refresh();
    },
    onError: () => toast.error("Não foi possível excluir a ideia."),
  });

  if (!idea) return null;

  const d = detail.data;
  const stageOptions = stages.filter((s) => !s.is_archived || s.id === idea.stage_id);
  const ideaAttachments = (d?.attachments ?? []).filter((a) => !a.task_id && !a.note_id);
  const origin = (idea.origin in ORIGIN_LABELS ? idea.origin : "app") as IdeaOrigin;
  const priority = (idea.priority in PRIORITY_LABELS ? idea.priority : "medium") as IdeaPriority;
  const suggestedValue = idea.suggested_by_member_id ?? (otherMode ? OTHER : NONE);

  const changeSuggested = (v: string) => {
    if (v === NONE) {
      setOtherMode(false);
      setOtherName("");
      update.mutate({ suggested_by_member_id: null, suggested_by_name: null });
    } else if (v === OTHER) {
      setOtherMode(true);
      update.mutate({ suggested_by_member_id: null });
    } else {
      setOtherMode(false);
      setOtherName("");
      update.mutate({ suggested_by_member_id: v, suggested_by_name: people.nameOf(v) });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl gap-0 overflow-y-auto p-0 sm:w-full">
        <DialogHeader className="space-y-1 border-b border-border p-4 pr-12">
          <DialogTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ideia</DialogTitle>
          <DialogDescription className="sr-only">Detalhes, tarefas, valores e observações da ideia.</DialogDescription>
          <Input
            value={title}
            maxLength={160}
            aria-label="Título da ideia"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const t = title.trim();
              if (!t) setTitle(idea.title);
              else if (t !== idea.title) update.mutate({ title: t });
            }}
            className="h-auto border-transparent bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:border-input focus-visible:px-3"
          />
        </DialogHeader>

        <div className="space-y-6 p-4">
          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Etapa</Label>
                <Select value={idea.stage_id} onValueChange={(v) => update.mutate({ stage_id: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.is_archived ? " (arquivada)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select
                  value={idea.assignee_id ?? NONE}
                  onValueChange={(v) => update.mutate({ assignee_id: v === NONE ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem responsável</SelectItem>
                    {people.assignees.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => update.mutate({ priority: v })}>
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
              <div className="space-y-1.5">
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={idea.due_date ?? ""}
                  onChange={(e) => update.mutate({ due_date: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Select
                  value={origin}
                  onValueChange={(v) => {
                    const patch: Partial<IdeaRow> = { origin: v };
                    if (v !== "member") {
                      patch.suggested_by_member_id = null;
                      patch.suggested_by_name = null;
                      setOtherMode(false);
                      setOtherName("");
                    }
                    update.mutate(patch);
                  }}
                >
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
              {origin === "member" && (
                <div className="space-y-1.5">
                  <Label>Sugerida por</Label>
                  <Select value={suggestedValue} onValueChange={changeSuggested}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Não informado</SelectItem>
                      {people.members.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Outra pessoa (digitar nome)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {origin === "member" && otherMode && (
                <div className="space-y-1.5 sm:col-start-2">
                  <Label>Nome de quem sugeriu</Label>
                  <Input
                    value={otherName}
                    maxLength={120}
                    onChange={(e) => setOtherName(e.target.value)}
                    onBlur={() => {
                      const n = otherName.trim();
                      if (n !== (idea.suggested_by_name ?? "")) update.mutate({ suggested_by_name: n || null });
                    }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  const t = description.trim();
                  if (t !== (idea.description ?? "")) update.mutate({ description: t || null });
                }}
                placeholder="Explique a ideia, o problema que resolve, como imagina funcionando..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Etiquetas</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onManageTags}>
                  <Tags className="mr-1 h-3.5 w-3.5" /> Gerenciar
                </Button>
              </div>
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ainda não há etiquetas. Crie em "Gerenciar".</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const on = d?.tagIds.includes(t.id) ?? false;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!d || toggleTag.isPending}
                        onClick={() => toggleTag.mutate(t.id)}
                        className={`rounded-full transition-opacity ${on ? "" : "opacity-40 hover:opacity-80"}`}
                      >
                        <TagChip tag={t} className={on ? "ring-1 ring-offset-1 ring-offset-background" : ""} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Anexos da ideia</Label>
              <AttachmentList attachments={ideaAttachments} />
              <AttachButton target={{ ideaId }} />
              <p className="text-xs text-muted-foreground">Imagem, PDF, Word, Excel, PowerPoint, TXT ou CSV, até 10 MB cada.</p>
            </div>
          </section>

          {detail.isLoading || !d ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : detail.error ? (
            <p className="text-sm text-destructive">Não foi possível carregar os detalhes desta ideia.</p>
          ) : (
            <>
              <hr className="border-border" />
              <IdeaTasksSection
                ideaId={ideaId}
                tasks={d.tasks}
                attachments={d.attachments}
                assignees={people.assignees}
                nameOf={people.nameOf}
              />
              <hr className="border-border" />
              <IdeaValuesSection ideaId={ideaId} values={d.values} />
              <hr className="border-border" />
              <IdeaNotesSection ideaId={ideaId} notes={d.notes} attachments={d.attachments} nameOf={people.nameOf} />
              <hr className="border-border" />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Histórico de movimentação</h3>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {d.history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-x-1.5">
                      {h.from_stage_name ? (
                        <>
                          <span>{h.from_stage_name}</span>
                          <ArrowRight className="h-3 w-3" />
                          <strong className="text-foreground">{h.to_stage_name ?? "etapa removida"}</strong>
                        </>
                      ) : (
                        <span>
                          Criada em <strong className="text-foreground">{h.to_stage_name ?? "—"}</strong>
                        </span>
                      )}
                      <span>
                        · {formatDateTime(h.moved_at)}
                        {h.moved_by ? ` · ${people.nameOf(h.moved_by)}` : ""}
                      </span>
                    </li>
                  ))}
                  {d.history.length === 0 && <li>Sem movimentações registradas.</li>}
                </ul>
              </section>
              <hr className="border-border" />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Excluir a ideia "${idea.title}" com tarefas, valores, observações e anexos? Não dá para desfazer.`))
                      remove.mutate();
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Excluir ideia
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
