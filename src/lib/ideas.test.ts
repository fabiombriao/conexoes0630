import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  formatBRLSigned,
  hasActiveFilters,
  matchesIdeaFilters,
  parseAmount,
  isOverdue,
  monthlyEquivalent,
  positionBetween,
  sanitizeFileName,
  summarizeValues,
  taskProgress,
} from "./ideas";

describe("monthlyEquivalent", () => {
  it("converte cada periodicidade para valor mensal", () => {
    expect(monthlyEquivalent(100, "monthly")).toBe(100);
    expect(monthlyEquivalent(300, "quarterly")).toBe(100);
    expect(monthlyEquivalent(600, "semiannual")).toBe(100);
    expect(monthlyEquivalent(1200, "annual")).toBe(100);
  });
});

describe("summarizeValues", () => {
  it("mantém único e recorrente separados e calcula o saldo de cada um", () => {
    const s = summarizeValues([
      { amount: 1000, nature: "gain", kind: "one_time", period: null },
      { amount: 400, nature: "cost", kind: "one_time", period: null },
      { amount: 1200, nature: "gain", kind: "recurring", period: "annual" },
      { amount: 30, nature: "cost", kind: "recurring", period: "monthly" },
    ]);
    expect(s.oneTimeNet).toBe(600);
    expect(s.monthlyGain).toBe(100);
    expect(s.monthlyCost).toBe(30);
    expect(s.monthlyNet).toBe(70);
    expect(s.isEmpty).toBe(false);
  });

  it("lista vazia fica marcada como vazia e zerada", () => {
    const s = summarizeValues([]);
    expect(s.isEmpty).toBe(true);
    expect(s.oneTimeNet).toBe(0);
    expect(s.monthlyNet).toBe(0);
  });

  it("aceita valores numéricos vindos como texto", () => {
    const s = summarizeValues([{ amount: "250.50" as unknown as number, nature: "gain", kind: "one_time", period: null }]);
    expect(s.oneTimeGain).toBe(250.5);
  });
});

describe("taskProgress", () => {
  it("conta tarefas concluídas", () => {
    expect(taskProgress([{ is_done: true }, { is_done: false }, { is_done: true }])).toEqual({ done: 2, total: 3 });
    expect(taskProgress([])).toEqual({ done: 0, total: 0 });
  });
});

describe("positionBetween", () => {
  it("insere entre dois vizinhos, no início, no fim e em coluna vazia", () => {
    expect(positionBetween(1, 3)).toBe(2);
    expect(positionBetween(null, 5)).toBe(4);
    expect(positionBetween(5, undefined)).toBe(6);
    expect(positionBetween(null, null)).toBe(1);
  });

  it("aceita zero como vizinho válido", () => {
    expect(positionBetween(0, 2)).toBe(1);
  });
});

describe("parseAmount", () => {
  it("entende formatos em reais", () => {
    expect(parseAmount("1.500,50")).toBe(1500.5);
    expect(parseAmount("1500,5")).toBe(1500.5);
    expect(parseAmount("1500.50")).toBe(1500.5);
    expect(parseAmount("1.500")).toBe(1500);
    expect(parseAmount("R$ 20")).toBe(20);
    expect(parseAmount("0")).toBe(0);
  });

  it("rejeita o que não é valor válido", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("10,999")).toBeNull();
  });
});

describe("formatBRLSigned", () => {
  it("coloca o sinal antes do símbolo", () => {
    expect(formatBRLSigned(-5).replace(/\s/g, " ")).toBe("-R$ 5,00");
    expect(formatBRLSigned(5, true).replace(/\s/g, " ")).toBe("+R$ 5,00");
    expect(formatBRLSigned(0, true).replace(/\s/g, " ")).toBe("R$ 0,00");
  });
});

describe("matchesIdeaFilters", () => {
  const idea = {
    title: "Aplicativo de Indicações",
    description: "Automatizar a cobrança",
    assignee_id: "u1",
    priority: "high",
    origin: "app",
    suggested_by_name: null,
  };

  it("sem filtros, tudo passa", () => {
    expect(matchesIdeaFilters(idea, [], false, EMPTY_FILTERS)).toBe(true);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("busca ignora acentos e maiúsculas", () => {
    expect(matchesIdeaFilters(idea, [], false, { ...EMPTY_FILTERS, search: "indicacoes" })).toBe(true);
    expect(matchesIdeaFilters(idea, [], false, { ...EMPTY_FILTERS, search: "COBRANCA" })).toBe(true);
    expect(matchesIdeaFilters(idea, [], false, { ...EMPTY_FILTERS, search: "outra coisa" })).toBe(false);
  });

  it("filtra por responsável, prioridade, origem e etiqueta", () => {
    expect(matchesIdeaFilters(idea, [], false, { ...EMPTY_FILTERS, assignee: "u1" })).toBe(true);
    expect(matchesIdeaFilters(idea, [], false, { ...EMPTY_FILTERS, assignee: "u2" })).toBe(false);
    expect(matchesIdeaFilters(idea, [], false, { ...EMPTY_FILTERS, assignee: "none" })).toBe(false);
    expect(matchesIdeaFilters({ ...idea, assignee_id: null }, [], false, { ...EMPTY_FILTERS, assignee: "none" })).toBe(true);
    expect(matchesIdeaFilters(idea, [], false, { ...EMPTY_FILTERS, priority: "low" })).toBe(false);
    expect(matchesIdeaFilters(idea, [], false, { ...EMPTY_FILTERS, origin: "group" })).toBe(false);
    expect(matchesIdeaFilters(idea, ["t1"], false, { ...EMPTY_FILTERS, tag: "t1" })).toBe(true);
    expect(matchesIdeaFilters(idea, ["t2"], false, { ...EMPTY_FILTERS, tag: "t1" })).toBe(false);
  });

  it("oculta ideias de etapa final quando pedido", () => {
    expect(matchesIdeaFilters(idea, [], true, { ...EMPTY_FILTERS, hideFinished: true })).toBe(false);
    expect(matchesIdeaFilters(idea, [], false, { ...EMPTY_FILTERS, hideFinished: true })).toBe(true);
  });
});

describe("isOverdue", () => {
  const today = new Date(2026, 10, 18); // 18/11/2026
  it("só vence depois do dia do prazo", () => {
    expect(isOverdue("2026-11-17", today)).toBe(true);
    expect(isOverdue("2026-11-18", today)).toBe(false);
    expect(isOverdue("2026-11-19", today)).toBe(false);
    expect(isOverdue(null, today)).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("remove acentos e caracteres inseguros", () => {
    expect(sanitizeFileName("Proposta Comercial – v2 (final).pdf")).toBe("Proposta_Comercial_v2_final_.pdf");
    expect(sanitizeFileName("???")).toBe("arquivo");
  });
});
