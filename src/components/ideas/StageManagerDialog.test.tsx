import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const perms = vi.hoisted(() => ({ isSuperAdmin: false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => perms }));

import { StageManagerDialog } from "@/components/ideas/StageManagerDialog";

const now = "2026-11-18T10:00:00Z";
const stages = [
  { id: "s1", name: "Nova ideia", color: "#64748b", position: 1, is_final: false, is_archived: false, created_at: now, updated_at: now },
];

describe("StageManagerDialog — exclusão de etapa", () => {
  it.each([
    ["Super Admin vê", true],
    ["Comissão não vê", false],
  ])("%s o botão Excluir, e os demais continuam", (_quem, isSuperAdmin) => {
    perms.isSuperAdmin = isSuperAdmin;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StageManagerDialog open onClose={() => {}} stages={stages} ideas={[]} />
      </QueryClientProvider>,
    );
    expect(!!screen.queryByRole("button", { name: "Excluir" })).toBe(isSuperAdmin);
    expect(screen.getByRole("button", { name: "Arquivar" })).toBeInTheDocument();
  });
});
