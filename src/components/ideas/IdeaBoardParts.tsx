import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, CheckSquare, Flag, GripVertical, Plus, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ORIGIN_LABELS,
  PRIORITY_LABELS,
  formatBRLSigned,
  formatDateBR,
  isOverdue,
  type IdeaOrigin,
  type IdeaPriority,
  type IdeaRow,
  type IdeaStage,
  type IdeaTag,
  type ValueSummary,
} from "@/lib/ideas";

export interface IdeaCardData {
  idea: IdeaRow;
  tags: IdeaTag[];
  summary: ValueSummary;
  progress: { done: number; total: number };
  assigneeName: string;
  isFinal: boolean;
}

const PRIORITY_STYLE: Record<IdeaPriority, string> = {
  high: "border-red-500/40 bg-red-500/10 text-red-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  low: "border-slate-500/40 bg-slate-500/10 text-slate-400",
};

export const TagChip: React.FC<{ tag: Pick<IdeaTag, "name" | "color">; className?: string }> = ({ tag, className }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${className ?? ""}`}
    style={{ color: tag.color, borderColor: `${tag.color}66`, backgroundColor: `${tag.color}1f` }}
  >
    {tag.name}
  </span>
);

function ValueLines({ summary }: { summary: ValueSummary }) {
  if (summary.isEmpty) return null;
  const hasOneTime = summary.oneTimeGain !== 0 || summary.oneTimeCost !== 0;
  const hasMonthly = summary.monthlyGain !== 0 || summary.monthlyCost !== 0;
  const tone = (n: number) => (n < 0 ? "text-red-400" : "text-emerald-400");
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium">
      {hasOneTime && (
        <span className={tone(summary.oneTimeNet)}>{formatBRLSigned(summary.oneTimeNet, true)} único</span>
      )}
      {hasMonthly && (
        <span className={tone(summary.monthlyNet)}>{formatBRLSigned(summary.monthlyNet, true)}/mês</span>
      )}
    </div>
  );
}

export const IdeaCardView = React.forwardRef<
  HTMLDivElement,
  {
    data: IdeaCardData;
    onOpen?: () => void;
    dragging?: boolean;
    overlay?: boolean;
    style?: React.CSSProperties;
    handleProps?: Record<string, unknown>;
  } & React.HTMLAttributes<HTMLDivElement>
>(({ data, onOpen, dragging, overlay, style, handleProps, ...rest }, ref) => {
  const { idea, tags, summary, progress, assigneeName, isFinal } = data;
  const overdue = !isFinal && isOverdue(idea.due_date);
  const priority = (idea.priority as IdeaPriority) in PRIORITY_LABELS ? (idea.priority as IdeaPriority) : "medium";

  return (
    <div
      ref={ref}
      style={style}
      {...rest}
      className={`group rounded-lg border bg-card p-3 text-left shadow-sm transition-colors ${
        dragging ? "opacity-40" : ""
      } ${overlay ? "border-primary shadow-xl rotate-1" : "border-border hover:border-primary/50"} ${
        isFinal ? "opacity-80" : ""
      }`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          aria-label="Arrastar ideia"
          className="mt-0.5 -ml-1 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
          {...handleProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 space-y-2 text-left">
          <p className="line-clamp-3 text-sm font-medium leading-snug">{idea.title}</p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((t) => (
                <TagChip key={t.id} tag={t} />
              ))}
              {tags.length > 3 && <span className="text-[11px] text-muted-foreground">+{tags.length - 3}</span>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${PRIORITY_STYLE[priority]}`}>
              {PRIORITY_LABELS[priority]}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {ORIGIN_LABELS[(idea.origin as IdeaOrigin) in ORIGIN_LABELS ? (idea.origin as IdeaOrigin) : "app"]}
            </span>
          </div>

          <ValueLines summary={summary} />

          {(progress.total > 0 || idea.due_date || assigneeName) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {progress.total > 0 && (
                <span
                  className={`inline-flex items-center gap-1 ${
                    progress.done === progress.total ? "text-emerald-400" : ""
                  }`}
                >
                  <CheckSquare className="h-3 w-3" />
                  {progress.done}/{progress.total}
                </span>
              )}
              {idea.due_date && (
                <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-red-400" : ""}`}>
                  <CalendarDays className="h-3 w-3" />
                  {formatDateBR(idea.due_date)}
                </span>
              )}
              {assigneeName && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {assigneeName.split(" ")[0]}
                </span>
              )}
            </div>
          )}
        </button>
      </div>
    </div>
  );
});
IdeaCardView.displayName = "IdeaCardView";

export const SortableIdeaCard: React.FC<{ data: IdeaCardData; onOpen: () => void }> = ({ data, onOpen }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: data.idea.id,
  });
  return (
    <IdeaCardView
      ref={setNodeRef}
      data={data}
      onOpen={onOpen}
      dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      handleProps={{ ...attributes, ...listeners }}
    />
  );
};

export const COLUMN_PREFIX = "col:";

export const IdeaColumn: React.FC<{
  stage: IdeaStage;
  ids: string[];
  cards: Map<string, IdeaCardData>;
  summary: ValueSummary;
  onOpen: (ideaId: string) => void;
  onAdd: (stageId: string) => void;
}> = ({ stage, ids, cards, summary, onOpen, onAdd }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${stage.id}` });
  const hasOneTime = summary.oneTimeGain !== 0 || summary.oneTimeCost !== 0;
  const hasMonthly = summary.monthlyGain !== 0 || summary.monthlyCost !== 0;

  return (
    <section
      className={`flex max-h-full w-[18rem] shrink-0 flex-col rounded-xl border bg-muted/30 ${
        isOver ? "border-primary/60" : "border-border"
      }`}
      style={{ borderTopColor: stage.color, borderTopWidth: 3 }}
    >
      <header className="space-y-1 px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{stage.name}</h2>
          {stage.is_final && <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Etapa final" />}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{ids.length}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            aria-label={`Nova ideia em ${stage.name}`}
            onClick={() => onAdd(stage.id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {(hasOneTime || hasMonthly) && (
          <div className="space-y-0.5 text-[11px] text-muted-foreground">
            {hasOneTime && (
              <p>
                Único:{" "}
                <span className={summary.oneTimeNet < 0 ? "text-red-400" : "text-emerald-400"}>
                  {formatBRLSigned(summary.oneTimeNet, true)}
                </span>
              </p>
            )}
            {hasMonthly && (
              <p>
                Recorrente:{" "}
                <span className={summary.monthlyNet < 0 ? "text-red-400" : "text-emerald-400"}>
                  {formatBRLSigned(summary.monthlyNet, true)}/mês
                </span>
              </p>
            )}
          </div>
        )}
      </header>

      <div ref={setNodeRef} className="flex min-h-[4rem] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const data = cards.get(id);
            return data ? <SortableIdeaCard key={id} data={data} onOpen={() => onOpen(id)} /> : null;
          })}
        </SortableContext>
        {ids.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Solte uma ideia aqui
          </p>
        )}
      </div>
    </section>
  );
};
