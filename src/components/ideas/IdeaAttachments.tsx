import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { IDEA_KEYS } from "@/hooks/useIdeas";
import {
  IDEA_ATTACHMENT_ACCEPT,
  deleteIdeaAttachment,
  formatFileSize,
  openIdeaAttachment,
  uploadIdeaFile,
  validateAttachment,
  type UploadTarget,
} from "@/lib/ideaAttachments";
import type { IdeaAttachment } from "@/lib/ideas";
import { Button } from "@/components/ui/button";

export const AttachmentList: React.FC<{ attachments: IdeaAttachment[] }> = ({ attachments }) => {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  if (attachments.length === 0) return null;

  const open = async (att: IdeaAttachment) => {
    try {
      await openIdeaAttachment(att);
    } catch {
      toast.error("Não foi possível abrir o arquivo.");
    }
  };

  const remove = async (att: IdeaAttachment) => {
    if (!window.confirm(`Remover o anexo "${att.file_name}"?`)) return;
    setBusyId(att.id);
    try {
      await deleteIdeaAttachment(att);
      qc.invalidateQueries({ queryKey: IDEA_KEYS.root });
    } catch {
      toast.error("Não foi possível remover o anexo.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ul className="flex flex-wrap gap-1.5">
      {attachments.map((att) => {
        const isImage = att.content_type?.startsWith("image/");
        const Icon = isImage ? ImageIcon : FileText;
        return (
          <li
            key={att.id}
            className="flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/40 pl-2 text-xs"
          >
            <button
              type="button"
              onClick={() => open(att)}
              className="flex min-w-0 items-center gap-1.5 py-1 hover:text-primary"
              title={att.file_name}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[12rem]">{att.file_name}</span>
              {att.size_bytes ? (
                <span className="shrink-0 text-muted-foreground">{formatFileSize(att.size_bytes)}</span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label={`Remover ${att.file_name}`}
              disabled={busyId === att.id}
              onClick={() => remove(att)}
              className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

/** Botão que envia arquivos direto para a ideia, tarefa ou observação indicada em `target`. */
export const AttachButton: React.FC<{
  target: UploadTarget;
  label?: string;
  size?: "sm" | "default";
}> = ({ target, label = "Anexar", size = "sm" }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;
    setBusy(true);
    let sent = 0;
    for (const file of files) {
      try {
        await uploadIdeaFile(file, target, user.id);
        sent++;
      } catch (err) {
        toast.error((err as Error)?.message || `Falha ao enviar "${file.name}".`);
      }
    }
    setBusy(false);
    if (sent > 0) qc.invalidateQueries({ queryKey: IDEA_KEYS.root });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IDEA_ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={handle}
      />
      <Button type="button" variant="outline" size={size} disabled={busy} onClick={() => inputRef.current?.click()}>
        <Paperclip className="mr-1.5 h-4 w-4" />
        {busy ? "Enviando..." : label}
      </Button>
    </>
  );
};

/** Seletor de arquivos "em espera" (usado antes de a observação existir). */
export const StagedFiles: React.FC<{
  files: File[];
  onChange: (files: File[]) => void;
}> = ({ files, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const ok: File[] = [];
    for (const f of picked) {
      const err = validateAttachment(f);
      if (err) toast.error(err);
      else ok.push(f);
    }
    if (ok.length) onChange([...files, ...ok]);
  };

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IDEA_ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={add}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Paperclip className="mr-1.5 h-4 w-4" /> Anexar
      </Button>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-1 rounded-md border border-border bg-muted/40 pl-2 text-xs"
            >
              <span className="max-w-[12rem] truncate py-1">{f.name}</span>
              <button
                type="button"
                aria-label={`Tirar ${f.name}`}
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="p-1.5 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
