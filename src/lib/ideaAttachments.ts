import { supabase } from "@/integrations/supabase/client";
import {
  IDEA_ATTACHMENT_BUCKET,
  IDEA_ATTACHMENT_MAX_BYTES,
  sanitizeFileName,
  type IdeaAttachment,
} from "@/lib/ideas";

export const IDEA_ATTACHMENT_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

/** Devolve a mensagem de erro, ou null se o arquivo pode ser enviado. */
export function validateAttachment(file: Pick<File, "name" | "size" | "type">): string | null {
  if (file.size > IDEA_ATTACHMENT_MAX_BYTES) {
    return `"${file.name}" passa de 10 MB.`;
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return `"${file.name}": tipo de arquivo não permitido (use imagem, PDF, Word, Excel, PowerPoint, TXT ou CSV).`;
  }
  return null;
}

export interface UploadTarget {
  ideaId: string;
  taskId?: string | null;
  noteId?: string | null;
}

export async function uploadIdeaFile(file: File, target: UploadTarget, userId: string): Promise<void> {
  const error = validateAttachment(file);
  if (error) throw new Error(error);

  const path = `${target.ideaId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error: upErr } = await supabase.storage
    .from(IDEA_ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;

  const { error: rowErr } = await supabase.from("idea_attachments").insert({
    idea_id: target.ideaId,
    task_id: target.taskId ?? null,
    note_id: target.noteId ?? null,
    file_path: path,
    file_name: file.name,
    content_type: file.type,
    size_bytes: file.size,
    uploaded_by: userId,
  });
  if (rowErr) {
    // não deixa arquivo órfão no bucket
    await supabase.storage.from(IDEA_ATTACHMENT_BUCKET).remove([path]);
    throw rowErr;
  }
}

export async function openIdeaAttachment(att: Pick<IdeaAttachment, "file_path">): Promise<void> {
  const { data, error } = await supabase.storage
    .from(IDEA_ATTACHMENT_BUCKET)
    .createSignedUrl(att.file_path, 120);
  if (error || !data?.signedUrl) throw error ?? new Error("Não foi possível abrir o arquivo.");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export async function deleteIdeaAttachment(att: Pick<IdeaAttachment, "id" | "file_path">): Promise<void> {
  const { error } = await supabase.from("idea_attachments").delete().eq("id", att.id);
  if (error) throw error;
  await supabase.storage.from(IDEA_ATTACHMENT_BUCKET).remove([att.file_path]);
}

/**
 * Apagar tarefa, observação ou ideia remove as linhas de anexo em cascata, mas não os
 * arquivos do bucket — por isso o app apaga os arquivos antes.
 */
export async function removeStorageFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(IDEA_ATTACHMENT_BUCKET).remove(paths);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
