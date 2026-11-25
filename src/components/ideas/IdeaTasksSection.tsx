import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IDEA_KEYS, type IdeaPerson } from "@/hooks/useIdeas";
import { removeStorageFiles } from "@/lib/ideaAttachments";
import { formatDateBR, isOverdue, taskProgress, type IdeaAttachment, type IdeaTask } from "@/lib/ideas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AttachButton, AttachmentList } from "@/components/ideas/IdeaAttachments";

const NONE = "none";

const TaskRow: React.FC<{
  task: IdeaTask;
  attachments: IdeaAttachment[];
  assignees: IdeaPerson[];
  nameOf: (id: string | null | undefined) => string;
  onChanged: () => void;
}> = ({ task, attachments, assignees, nameOf, onChanged }) => {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");

  const update = useMutation({
    mutationFn: async (patch: Partial<Omit<IdeaTask, "id" | "idea_id">>) => {
      const { error } = await supabase.from("idea_tasks").update(patch).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: () => toast.error("Não foi possível salvar a tarefa."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await removeStorageFiles(attachments.map((a) => a.file_path));
      const { error } = await supabase.from("idea_tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: () => toast.error("Não foi possível excluir a tarefa."),
  });

  const overdue = !task.is_done && isOverdue(task.due_date);

  return (
    <li className="rounded-lg border border-border">
      <div className="flex items-center gap-2 p-2">
        <Checkbox
          checked={task.is_done}
          onCheckedChange={(v) => update.mutate({ is_done: v === true })}
          aria-label={`Concluir "${task.title}"`}
        />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className={`min-w-0 flex-1 truncate text-sm ${task.is_done ? "text-muted-foreground line-through" : ""}`}>
            {task.title}
          </span>
        </button>
        {!expanded && (
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {task.assignee_id && <span className="hidden sm:inline">{nameOf(task.assignee_id).split(" ")[0]}</span>}
            {task.due_date && (
              <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-red-400" : ""}`}>
                <CalendarDays className="h-3 w-3" />
                {formatDateBR(task.due_date)}
              </span>
            )}
            {attachments.length > 0 && <span>📎{attachments.length}</span>}
          </div>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border p-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                const t = title.trim();
                if (!t) setTitle(task.title);
                else if (t !== task.title) update.mutate({ title: t });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                const d = description.trim();
                if (d !== (task.description ?? "")) update.mutate({ description: d || null });
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select
                value={task.assignee_id ?? NONE}
                onValueChange={(v) => update.mutate({ assignee_id: v === NONE ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem responsável</SelectItem>
                  {assignees.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => update.mutate({ due_date: e.target.value || null })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Anexos</Label>
            <AttachmentList attachments={attachments} />
            <AttachButton target={{ ideaId: task.idea_id, taskId: task.id }} />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (window.confirm(`Excluir a tarefa "${task.title}"?`)) remove.mutate();
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Excluir tarefa
            </Button>
          </div>
        </div>
      )}
    </li>
  );
};

export const IdeaTasksSection: React.FC<{
  ideaId: string;
  tasks: IdeaTask[];
  attachments: IdeaAttachment[];
  assignees: IdeaPerson[];
  nameOf: (id: string | null | undefined) => string;
}> = ({ ideaId, tasks, attachments, assignees, nameOf }) => {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: IDEA_KEYS.root });
  const { done, total } = taskProgress(tasks);

  const add = useMutation({
    mutationFn: async () => {
      const maxPos = tasks.reduce((m, t) => Math.max(m, t.position), 0);
      const { error } = await supabase
        .from("idea_tasks")
        .insert({ idea_id: ideaId, title: newTitle.trim(), position: maxPos + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTitle("");
      refresh();
    },
    onError: () => toast.error("Não foi possível adicionar a tarefa."),
  });

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Tarefas</h3>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {done} de {total} concluída{total === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {total > 0 && <Progress value={(done / total) * 100} className="h-2" />}

      {total > 0 && (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              attachments={attachments.filter((a) => a.task_id === t.id)}
              assignees={assignees}
              nameOf={nameOf}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newTitle.trim()) add.mutate();
        }}
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nova tarefa..."
          maxLength={200}
        />
        <Button type="submit" variant="secondary" disabled={!newTitle.trim() || add.isPending}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </form>
    </section>
  );
};
