import React, { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Lightbulb, Plus, Search, Settings2, Tags, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import {
  IDEA_KEYS,
  useIdeaList,
  useIdeaPeople,
  useIdeaStages,
  useIdeaTagLinks,
  useIdeaTags,
  useIdeaTasksLite,
  useIdeaValues,
} from "@/hooks/useIdeas";
import {
  EMPTY_FILTERS,
  ORIGIN_LABELS,
  PRIORITY_LABELS,
  hasActiveFilters,
  matchesIdeaFilters,
  summarizeValues,
  taskProgress,
  positionBetween,
  type IdeaFilterState,
  type IdeaRow,
  type IdeaTag,
} from "@/lib/ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  COLUMN_PREFIX,
  IdeaCardView,
  IdeaColumn,
  type IdeaCardData,
} from "@/components/ideas/IdeaBoardParts";
import { IdeaDialog } from "@/components/ideas/IdeaDialog";
import { NewIdeaDialog } from "@/components/ideas/NewIdeaDialog";
import { StageManagerDialog } from "@/components/ideas/StageManagerDialog";
import { TagManagerDialog } from "@/components/ideas/TagManagerDialog";

type Columns = Record<string, string[]>;

const IdeasPage: React.FC = () => {
  const { canAccessIdeas, isPermissionsLoading } = usePermissions();
  const qc = useQueryClient();
  const enabled = canAccessIdeas;

  const stagesQ = useIdeaStages(enabled);
  const tagsQ = useIdeaTags(enabled);
  const ideasQ = useIdeaList(enabled);
  const linksQ = useIdeaTagLinks(enabled);
  const valuesQ = useIdeaValues(enabled);
  const tasksQ = useIdeaTasksLite(enabled);
  const people = useIdeaPeople(enabled);

  const [filters, setFilters] = useState<IdeaFilterState>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newIdeaStage, setNewIdeaStage] = useState<string | null | undefined>(undefined); // undefined = fechado
  const [stagesOpen, setStagesOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);

  const stages = stagesQ.data;
  const tags = tagsQ.data;
  const ideas = ideasQ.data;
  const links = linksQ.data;
  const values = valuesQ.data;
  const tasks = tasksQ.data;

  const visibleStages = useMemo(() => (stages ?? []).filter((s) => !s.is_archived), [stages]);
  const stageById = useMemo(() => new Map((stages ?? []).map((s) => [s.id, s])), [stages]);
  const ideaById = useMemo(() => new Map((ideas ?? []).map((i) => [i.id, i])), [ideas]);

  const cards = useMemo(() => {
    const tagById = new Map((tags ?? []).map((t) => [t.id, t]));
    const tagsByIdea = new Map<string, IdeaTag[]>();
    for (const l of links ?? []) {
      const t = tagById.get(l.tag_id);
      if (!t) continue;
      const arr = tagsByIdea.get(l.idea_id) ?? [];
      arr.push(t);
      tagsByIdea.set(l.idea_id, arr);
    }
    const valuesByIdea = new Map<string, NonNullable<typeof values>>();
    for (const v of values ?? []) {
      const arr = valuesByIdea.get(v.idea_id) ?? [];
      arr.push(v);
      valuesByIdea.set(v.idea_id, arr);
    }
    const tasksByIdea = new Map<string, NonNullable<typeof tasks>>();
    for (const t of tasks ?? []) {
      const arr = tasksByIdea.get(t.idea_id) ?? [];
      arr.push(t);
      tasksByIdea.set(t.idea_id, arr);
    }
    const map = new Map<string, IdeaCardData>();
    for (const idea of ideas ?? []) {
      map.set(idea.id, {
        idea,
        tags: tagsByIdea.get(idea.id) ?? [],
        summary: summarizeValues(valuesByIdea.get(idea.id) ?? []),
        progress: taskProgress(tasksByIdea.get(idea.id) ?? []),
        assigneeName: people.nameOf(idea.assignee_id),
        isFinal: !!stageById.get(idea.stage_id)?.is_final,
      });
    }
    return map;
  }, [ideas, tags, links, values, tasks, people, stageById]);

  /** Colunas (ids ordenados por posição) já com busca/filtros aplicados. */
  const baseColumns = useMemo<Columns>(() => {
    const cols: Columns = {};
    for (const s of visibleStages) cols[s.id] = [];
    const sorted = [...(ideas ?? [])].sort(
      (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
    );
    for (const idea of sorted) {
      if (!cols[idea.stage_id]) continue; // etapa arquivada: fica oculta
      const data = cards.get(idea.id);
      if (!data) continue;
      if (
        !matchesIdeaFilters(
          idea,
          data.tags.map((t) => t.id),
          data.isFinal,
          filters,
        )
      )
        continue;
      cols[idea.stage_id].push(idea.id);
    }
    return cols;
  }, [visibleStages, ideas, cards, filters]);

  const columns = dragColumns ?? baseColumns;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (cols: Columns, id: string): string | undefined => {
    if (id.startsWith(COLUMN_PREFIX)) return id.slice(COLUMN_PREFIX.length);
    return Object.keys(cols).find((k) => cols[k].includes(id));
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setDragColumns(Object.fromEntries(Object.entries(baseColumns).map(([k, v]) => [k, [...v]])));
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    setDragColumns((prev) => {
      if (!prev) return prev;
      const from = findContainer(prev, activeKey);
      const to = findContainer(prev, overKey);
      if (!from || !to || from === to) return prev;
      const overItems = prev[to];
      const overIndex = overItems.indexOf(overKey);
      let newIndex = overItems.length;
      if (overIndex >= 0) {
        const translated = active.rect.current.translated;
        const below = !!translated && translated.top > over.rect.top + over.rect.height / 2;
        newIndex = overIndex + (below ? 1 : 0);
      }
      return {
        ...prev,
        [from]: prev[from].filter((id) => id !== activeKey),
        [to]: [...overItems.slice(0, newIndex), activeKey, ...overItems.slice(newIndex)],
      };
    });
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    const items = dragColumns;
    setActiveId(null);
    if (!over || !items) {
      setDragColumns(null);
      return;
    }
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const container = findContainer(items, activeKey);
    if (!container) {
      setDragColumns(null);
      return;
    }

    let list = items[container];
    const oldIndex = list.indexOf(activeKey);
    if (!overKey.startsWith(COLUMN_PREFIX)) {
      const newIndex = list.indexOf(overKey);
      if (newIndex >= 0 && newIndex !== oldIndex) list = arrayMove(list, oldIndex, newIndex);
    }
    const finalIndex = list.indexOf(activeKey);

    const idea = ideaById.get(activeKey);
    const unchanged = idea && idea.stage_id === container && baseColumns[container]?.indexOf(activeKey) === finalIndex;
    if (!idea || unchanged) {
      setDragColumns(null);
      return;
    }

    const prevPos = finalIndex > 0 ? ideaById.get(list[finalIndex - 1])?.position : null;
    const nextPos = finalIndex < list.length - 1 ? ideaById.get(list[finalIndex + 1])?.position : null;
    const position = positionBetween(prevPos, nextPos);

    // atualização otimista: o cartão já fica no lugar novo antes da resposta do banco
    qc.setQueryData<IdeaRow[]>(IDEA_KEYS.ideas, (old) =>
      (old ?? []).map((i) => (i.id === activeKey ? { ...i, stage_id: container, position } : i)),
    );
    setDragColumns(null);

    const { error } = await supabase.from("ideas").update({ stage_id: container, position }).eq("id", activeKey);
    if (error) {
      toast.error("Não foi possível mover a ideia.");
      qc.invalidateQueries({ queryKey: IDEA_KEYS.ideas });
    } else if (idea.stage_id !== container) {
      qc.invalidateQueries({ queryKey: [...IDEA_KEYS.root, "detail", activeKey] });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDragColumns(null);
  };

  if (isPermissionsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!canAccessIdeas) return <Navigate to="/" replace />;

  const isLoading = stagesQ.isLoading || ideasQ.isLoading;
  const loadError = stagesQ.error || ideasQ.error;
  const totalVisible = Object.values(columns).reduce((n, ids) => n + ids.length, 0);
  const filtersOn = hasActiveFilters(filters);
  const setFilter = <K extends keyof IdeaFilterState>(key: K, value: IdeaFilterState[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const activeCard = activeId ? cards.get(activeId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Ideias</h1>
          {ideas && (
            <span className="text-sm text-muted-foreground">
              {filtersOn ? `${totalVisible} de ${ideas.length}` : ideas.length}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setTagsOpen(true)}>
            <Tags className="mr-1.5 h-4 w-4" /> Etiquetas
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStagesOpen(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" /> Etapas
          </Button>
          <Button size="sm" onClick={() => setNewIdeaStage(null)} disabled={visibleStages.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova ideia
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            placeholder="Buscar ideia..."
            className="h-9 pl-8"
          />
        </div>
        <Select value={filters.assignee} onValueChange={(v) => setFilter("assignee", v)}>
          <SelectTrigger className="h-9 w-[9.5rem]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            <SelectItem value="none">Sem responsável</SelectItem>
            {people.assignees.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.priority} onValueChange={(v) => setFilter("priority", v)}>
          <SelectTrigger className="h-9 w-[8.5rem]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda prioridade</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.origin} onValueChange={(v) => setFilter("origin", v)}>
          <SelectTrigger className="h-9 w-[9.5rem]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda origem</SelectItem>
            {Object.entries(ORIGIN_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(tags?.length ?? 0) > 0 && (
          <Select value={filters.tag} onValueChange={(v) => setFilter("tag", v)}>
            <SelectTrigger className="h-9 w-[8.5rem]">
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda etiqueta</SelectItem>
              {tags!.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2 px-1">
          <Switch
            id="hide-finished"
            checked={filters.hideFinished}
            onCheckedChange={(v) => setFilter("hideFinished", v)}
          />
          <Label htmlFor="hide-finished" className="cursor-pointer text-sm text-muted-foreground">
            Ocultar finalizadas
          </Label>
        </div>
        {filtersOn && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            <X className="mr-1 h-4 w-4" /> Limpar
          </Button>
        )}
      </div>

      {loadError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar as ideias. Tente recarregar a página.
        </p>
      ) : isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-[18rem] shrink-0" />
          ))}
        </div>
      ) : visibleStages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma etapa ativa. Use <strong>Etapas</strong> para criar as colunas do quadro.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
            {visibleStages.map((stage) => {
              const ids = columns[stage.id] ?? [];
              const colValues = ids.flatMap((id) => {
                const d = cards.get(id);
                return d ? (values ?? []).filter((v) => v.idea_id === d.idea.id) : [];
              });
              return (
                <IdeaColumn
                  key={stage.id}
                  stage={stage}
                  ids={ids}
                  cards={cards}
                  summary={summarizeValues(colValues)}
                  onOpen={setOpenId}
                  onAdd={setNewIdeaStage}
                />
              );
            })}
          </div>
          <DragOverlay>{activeCard ? <IdeaCardView data={activeCard} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      {openId && ideaById.get(openId) && (
        <IdeaDialog
          ideaId={openId}
          stages={stages ?? []}
          tags={tags ?? []}
          people={people}
          onClose={() => setOpenId(null)}
          onManageTags={() => setTagsOpen(true)}
        />
      )}

      <NewIdeaDialog
        open={newIdeaStage !== undefined}
        defaultStageId={newIdeaStage ?? visibleStages[0]?.id ?? null}
        stages={visibleStages}
        ideas={ideas ?? []}
        onClose={() => setNewIdeaStage(undefined)}
        onCreated={(id) => setOpenId(id)}
      />
      <StageManagerDialog open={stagesOpen} onClose={() => setStagesOpen(false)} stages={stages ?? []} ideas={ideas ?? []} />
      <TagManagerDialog open={tagsOpen} onClose={() => setTagsOpen(false)} tags={tags ?? []} />
    </div>
  );
};

export default IdeasPage;
