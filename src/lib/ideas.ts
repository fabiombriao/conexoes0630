// Utilitários do quadro de ideias (CRM de ideias, só Super Admin).

import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type IdeaStage = Tables["idea_stages"]["Row"];
export type IdeaTag = Tables["idea_tags"]["Row"];
export type IdeaRow = Tables["ideas"]["Row"];
export type IdeaTask = Tables["idea_tasks"]["Row"];
export type IdeaValue = Tables["idea_values"]["Row"];
export type IdeaNote = Tables["idea_notes"]["Row"];
export type IdeaAttachment = Tables["idea_attachments"]["Row"];
export type IdeaHistoryRow = Tables["idea_history"]["Row"];

export type IdeaOrigin = "app" | "group" | "member";
export type IdeaPriority = "low" | "medium" | "high";
export type ValueNature = "gain" | "cost";
export type ValueKind = "one_time" | "recurring";
export type ValuePeriod = "monthly" | "quarterly" | "semiannual" | "annual";

export const ORIGIN_LABELS: Record<IdeaOrigin, string> = {
  app: "Melhoria do app",
  group: "Ideia para o grupo",
  member: "Sugestão de membro",
};

export const PRIORITY_LABELS: Record<IdeaPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const NATURE_LABELS: Record<ValueNature, string> = {
  gain: "Ganho",
  cost: "Custo",
};

export const KIND_LABELS: Record<ValueKind, string> = {
  one_time: "Único",
  recurring: "Recorrente",
};

export const PERIOD_LABELS: Record<ValuePeriod, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

const MONTHS_PER_PERIOD: Record<ValuePeriod, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export const IDEA_ATTACHMENT_BUCKET = "idea-attachments";
export const IDEA_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const formatBRL = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Como formatBRL, mas com o sinal antes do símbolo (-R$ 5,00) e "+" opcional. */
export const formatBRLSigned = (value: number, plus = false) => {
  const abs = formatBRL(Math.abs(value));
  if (value < 0) return `-${abs}`;
  return plus && value > 0 ? `+${abs}` : abs;
};

/**
 * Lê um valor digitado em reais ("1.500,50", "1500,5", "1500.50", "R$ 20").
 * Devolve null se não for um valor válido (vazio, negativo, mais de 2 casas).
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/R\$|\s/g, "");
  if (!s) return null;
  let normalized = s;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n < 1e12 ? n : null;
}

/** Valor recorrente convertido para "por mês". */
export function monthlyEquivalent(amount: number, period: ValuePeriod): number {
  return amount / MONTHS_PER_PERIOD[period];
}

export interface ValueSummary {
  oneTimeGain: number;
  oneTimeCost: number;
  oneTimeNet: number;
  monthlyGain: number;
  monthlyCost: number;
  monthlyNet: number;
  isEmpty: boolean;
}

/**
 * Soma os valores de uma ou mais ideias. Únicos e recorrentes ficam separados
 * (somá-los numa conta só enganaria); os recorrentes são levados para "por mês".
 */
export function summarizeValues(
  values: Pick<IdeaValue, "amount" | "nature" | "kind" | "period">[],
): ValueSummary {
  const s: ValueSummary = {
    oneTimeGain: 0,
    oneTimeCost: 0,
    oneTimeNet: 0,
    monthlyGain: 0,
    monthlyCost: 0,
    monthlyNet: 0,
    isEmpty: values.length === 0,
  };

  for (const v of values) {
    const amount = Number(v.amount) || 0;
    if (v.kind === "recurring" && v.period) {
      const monthly = monthlyEquivalent(amount, v.period as ValuePeriod);
      if (v.nature === "gain") s.monthlyGain += monthly;
      else s.monthlyCost += monthly;
    } else if (v.nature === "gain") {
      s.oneTimeGain += amount;
    } else {
      s.oneTimeCost += amount;
    }
  }

  s.oneTimeNet = s.oneTimeGain - s.oneTimeCost;
  s.monthlyNet = s.monthlyGain - s.monthlyCost;
  return s;
}

export function taskProgress(tasks: Pick<IdeaTask, "is_done">[]): { done: number; total: number } {
  return { done: tasks.filter((t) => t.is_done).length, total: tasks.length };
}

/**
 * Posição (ordenação fracionária) para inserir um item entre dois vizinhos,
 * sem reescrever a coluna inteira a cada movimento.
 */
export function positionBetween(before: number | null | undefined, after: number | null | undefined): number {
  const hasBefore = typeof before === "number";
  const hasAfter = typeof after === "number";
  if (hasBefore && hasAfter) return (before + after) / 2;
  if (hasBefore) return before + 1;
  if (hasAfter) return after - 1;
  return 1;
}

export interface IdeaFilterState {
  search: string;
  /** "all" | "none" (sem responsável) | id do responsável */
  assignee: string;
  priority: string;
  tag: string;
  origin: string;
  hideFinished: boolean;
}

export const EMPTY_FILTERS: IdeaFilterState = {
  search: "",
  assignee: "all",
  priority: "all",
  tag: "all",
  origin: "all",
  hideFinished: false,
};

export const hasActiveFilters = (f: IdeaFilterState) =>
  f.search.trim() !== "" ||
  f.assignee !== "all" ||
  f.priority !== "all" ||
  f.tag !== "all" ||
  f.origin !== "all" ||
  f.hideFinished;

const normalizeText = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function matchesIdeaFilters(
  idea: Pick<IdeaRow, "title" | "description" | "assignee_id" | "priority" | "origin" | "suggested_by_name">,
  tagIds: string[],
  isFinalStage: boolean,
  f: IdeaFilterState,
): boolean {
  if (f.hideFinished && isFinalStage) return false;
  if (f.assignee === "none" ? idea.assignee_id : f.assignee !== "all" && idea.assignee_id !== f.assignee) return false;
  if (f.priority !== "all" && idea.priority !== f.priority) return false;
  if (f.origin !== "all" && idea.origin !== f.origin) return false;
  if (f.tag !== "all" && !tagIds.includes(f.tag)) return false;
  const q = normalizeText(f.search.trim());
  if (q) {
    const hay = normalizeText(`${idea.title} ${idea.description ?? ""} ${idea.suggested_by_name ?? ""}`);
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Prazo vencido (data YYYY-MM-DD anterior a hoje, no fuso local). */
export function isOverdue(dueDate: string | null | undefined, today: Date = new Date()): boolean {
  if (!dueDate) return false;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Date(y, m - 1, d) < t;
}

export function formatDateBR(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** Nome seguro para o caminho do arquivo no Storage. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "arquivo";
}
