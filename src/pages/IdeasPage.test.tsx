import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const now = "2026-11-18T10:00:00Z";
const stages = [
  { id: "s1", name: "Nova ideia", color: "#64748b", position: 1, is_final: false, is_archived: false, created_at: now, updated_at: now },
  { id: "s2", name: "Em análise", color: "#3b82f6", position: 2, is_final: false, is_archived: false, created_at: now, updated_at: now },
  { id: "s3", name: "Concluída", color: "#10b981", position: 3, is_final: true, is_archived: false, created_at: now, updated_at: now },
];
const idea = (id: string, title: string, stage: string, position: number) => ({
  id, title, description: "desc", stage_id: stage, origin: "app", suggested_by_member_id: null, suggested_by_name: null,
  assignee_id: ADMIN, priority: "high", due_date: "2020-01-01", position, created_by: ADMIN, created_at: now, updated_at: now,
});
const tables: Record<string, unknown[]> = {
  idea_stages: stages,
  idea_tags: [{ id: "t1", name: "Receita", color: "#f97316", created_at: now }],
  ideas: [idea("i1", "Cobrar mensalidade pelo app", "s1", 1), idea("i2", "Ranking por segmento", "s2", 1), idea("i3", "Ideia pronta", "s3", 1)],
  idea_tag_links: [{ idea_id: "i1", tag_id: "t1" }],
  idea_values: [
    { id: "v1", idea_id: "i1", label: null, amount: 1000, nature: "gain", kind: "one_time", period: null, created_at: now },
    { id: "v2", idea_id: "i1", label: null, amount: 1200, nature: "gain", kind: "recurring", period: "annual", created_at: now },
  ],
  idea_tasks: [{ id: "k1", idea_id: "i1", title: "Desenhar", is_done: true, position: 1, description: null, assignee_id: null, due_date: null, created_at: now }],
  idea_notes: [{ id: "n1", idea_id: "i1", body: "Primeira observação", author_id: ADMIN, created_at: now }],
  idea_attachments: [],
  idea_history: [{ id: "h1", idea_id: "i1", from_stage_id: null, from_stage_name: null, to_stage_id: "s1", to_stage_name: "Nova ideia", moved_by: ADMIN, moved_at: now }],
  profiles: [{ id: ADMIN, full_name: "Fábio Briao", status: "active" }],
};

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    const result = () => Promise.resolve({ data: tables[table] ?? [], error: null });
    for (const m of ["select", "eq", "order", "insert", "update", "delete"]) b[m] = () => b;
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => result().then(res, rej);
    return b;
  };
  return { supabase: { from: builder, rpc: (name: string) => Promise.resolve({ data: name === "get_idea_team" ? [{ user_id: ADMIN }] : null, error: null }), storage: { from: () => ({}) } } };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canAccessIdeas: true, isPermissionsLoading: false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: ADMIN } }) }));

import IdeasPage from "@/pages/IdeasPage";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <IdeasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("IdeasPage", () => {
  it("mostra colunas, cartões, soma e abre o diálogo da ideia", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Cobrar mensalidade pelo app")).toBeInTheDocument());
    expect(screen.getByText("Nova ideia", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByText("Em análise")).toBeInTheDocument();
    expect(screen.getByText("Ranking por segmento")).toBeInTheDocument();
    // soma da coluna: 1000 único; 1200/12 = 100/mês
    expect(screen.getAllByText(/\+R\$\s*1\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+R\$\s*100,00\/mês/).length).toBeGreaterThan(0);
    expect(screen.getByText("1/1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cobrar mensalidade pelo app"));
    await waitFor(() => expect(screen.getByText("Primeira observação")).toBeInTheDocument());
    expect(screen.getByLabelText("Título da ideia")).toHaveValue("Cobrar mensalidade pelo app");
    expect(screen.getByText("Histórico de movimentação")).toBeInTheDocument();
    expect(screen.getByText("Saldo recorrente:", { exact: false })).toBeInTheDocument();
  });

  it("ocultar finalizadas esconde ideias de etapa final", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Ideia pronta")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Ocultar finalizadas"));
    await waitFor(() => expect(screen.queryByText("Ideia pronta")).not.toBeInTheDocument());
  });
});
