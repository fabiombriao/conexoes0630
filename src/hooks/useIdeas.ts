import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sortByText } from "@/lib/sortByText";
import type {
  IdeaAttachment,
  IdeaHistoryRow,
  IdeaNote,
  IdeaRow,
  IdeaStage,
  IdeaTag,
  IdeaTask,
  IdeaValue,
} from "@/lib/ideas";

export const IDEA_KEYS = {
  root: ["ideas"] as const,
  stages: ["ideas", "stages"] as const,
  tags: ["ideas", "tags"] as const,
  ideas: ["ideas", "list"] as const,
  links: ["ideas", "tag-links"] as const,
  values: ["ideas", "values"] as const,
  tasks: ["ideas", "tasks"] as const,
  people: ["ideas", "people"] as const,
  detail: (ideaId: string) => ["ideas", "detail", ideaId] as const,
};

export function useIdeaStages(enabled: boolean) {
  return useQuery({
    queryKey: IDEA_KEYS.stages,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("idea_stages").select("*").order("position");
      if (error) throw error;
      return (data ?? []) as IdeaStage[];
    },
  });
}

export function useIdeaTags(enabled: boolean) {
  return useQuery({
    queryKey: IDEA_KEYS.tags,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("idea_tags").select("*");
      if (error) throw error;
      return sortByText((data ?? []) as IdeaTag[], (t) => t.name);
    },
  });
}

export function useIdeaList(enabled: boolean) {
  return useQuery({
    queryKey: IDEA_KEYS.ideas,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("ideas").select("*");
      if (error) throw error;
      return (data ?? []) as IdeaRow[];
    },
  });
}

export function useIdeaTagLinks(enabled: boolean) {
  return useQuery({
    queryKey: IDEA_KEYS.links,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("idea_tag_links").select("idea_id, tag_id");
      if (error) throw error;
      return (data ?? []) as { idea_id: string; tag_id: string }[];
    },
  });
}

export function useIdeaValues(enabled: boolean) {
  return useQuery({
    queryKey: IDEA_KEYS.values,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("idea_values").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as IdeaValue[];
    },
  });
}

export type IdeaTaskLite = Pick<IdeaTask, "id" | "idea_id" | "is_done">;

export function useIdeaTasksLite(enabled: boolean) {
  return useQuery({
    queryKey: IDEA_KEYS.tasks,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("idea_tasks").select("id, idea_id, is_done");
      if (error) throw error;
      return (data ?? []) as IdeaTaskLite[];
    },
  });
}

/** Tudo o que só o diálogo da ideia precisa (tarefas completas, notas, anexos, histórico). */
export function useIdeaDetail(ideaId: string) {
  return useQuery({
    queryKey: IDEA_KEYS.detail(ideaId),
    queryFn: async () => {
      const [tasks, values, notes, attachments, history, links] = await Promise.all([
        supabase.from("idea_tasks").select("*").eq("idea_id", ideaId),
        supabase.from("idea_values").select("*").eq("idea_id", ideaId),
        supabase.from("idea_notes").select("*").eq("idea_id", ideaId),
        supabase.from("idea_attachments").select("*").eq("idea_id", ideaId),
        supabase.from("idea_history").select("*").eq("idea_id", ideaId),
        supabase.from("idea_tag_links").select("tag_id").eq("idea_id", ideaId),
      ]);
      for (const r of [tasks, values, notes, attachments, history, links]) if (r.error) throw r.error;
      return {
        tasks: ((tasks.data ?? []) as IdeaTask[]).sort(
          (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
        ),
        values: ((values.data ?? []) as IdeaValue[]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
        notes: ((notes.data ?? []) as IdeaNote[]).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        attachments: ((attachments.data ?? []) as IdeaAttachment[]).sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        ),
        history: ((history.data ?? []) as IdeaHistoryRow[]).sort((a, b) => b.moved_at.localeCompare(a.moved_at)),
        tagIds: (links.data ?? []).map((l) => l.tag_id),
      };
    },
  });
}

export interface IdeaPerson {
  id: string;
  full_name: string;
}

/** Perfis (para nomes de autor/responsável/sugestão) e Super Admins (possíveis responsáveis). */
export function useIdeaPeople(enabled: boolean) {
  const query = useQuery({
    queryKey: IDEA_KEYS.people,
    enabled,
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, status"),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      return {
        profiles: (profiles ?? []) as { id: string; full_name: string | null; status: string }[],
        adminIds: new Set((roles ?? []).map((r) => r.user_id)),
      };
    },
  });

  return useMemo(() => {
    const profiles = query.data?.profiles ?? [];
    const adminIds = query.data?.adminIds ?? new Set<string>();
    const toPerson = (p: { id: string; full_name: string | null }): IdeaPerson => ({
      id: p.id,
      full_name: p.full_name?.trim() || "Sem nome",
    });
    const names = new Map(profiles.map((p) => [p.id, toPerson(p).full_name]));
    return {
      isLoading: query.isLoading,
      members: sortByText(profiles.filter((p) => p.status === "active").map(toPerson), (p) => p.full_name),
      superAdmins: sortByText(profiles.filter((p) => adminIds.has(p.id)).map(toPerson), (p) => p.full_name),
      nameOf: (id: string | null | undefined) => (id ? names.get(id) ?? "—" : ""),
    };
  }, [query.data, query.isLoading]);
}
