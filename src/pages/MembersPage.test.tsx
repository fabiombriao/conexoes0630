import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const MEMBER = "22222222-2222-2222-2222-222222222222";
const db = vi.hoisted(() => ({ committee: new Set<string>(), writes: [] as unknown[], superAdmin: true }));

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    let op = "select";
    const filters: Record<string, unknown> = {};
    const run = () => {
      if (table === "profiles") return [{ id: MEMBER, full_name: "Amanda Teste", keywords: [] }];
      if (op === "delete") {
        db.writes.push({ op, ...filters });
        return db.committee.delete(filters.user_id as string) ? [{ id: "r1" }] : [];
      }
      return [...db.committee].map((user_id) => ({ user_id }));
    };
    const b: Record<string, unknown> = {};
    for (const m of ["select", "not", "neq", "order"]) b[m] = () => b;
    b.eq = (column: string, value: unknown) => ((filters[column] = value), b);
    b.delete = () => ((op = "delete"), b);
    b.upsert = (row: { user_id: string; role: string }, options: unknown) => {
      db.writes.push({ op: "upsert", table, row, options });
      db.committee.add(row.user_id);
      return Promise.resolve({ error: null });
    };
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve({ data: run(), error: null }).then(res, rej);
    return b;
  };
  return { supabase: { from: builder } };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isSuperAdmin: db.superAdmin }) }));
vi.mock("@/components/PromoteMemberDialog", () => ({ PromoteMemberDialog: () => null }));
vi.mock("@/components/SuspendMemberDialog", () => ({ SuspendMemberDialog: () => null }));

import MembersPage from "@/pages/MembersPage";

const openMember = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MembersPage />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByText("Amanda Teste"));
};

describe("MembersPage — Comissão", () => {
  beforeEach(() => {
    db.committee.clear();
    db.writes.length = 0;
    db.superAdmin = true;
  });

  it("Super Admin promove à Comissão e depois remove", async () => {
    await openMember();
    const promote = await screen.findByRole("button", { name: "Promover à Comissão" });
    await waitFor(() => expect(promote).toBeEnabled());
    fireEvent.click(promote);

    const remove = await screen.findByRole("button", { name: "Remover da Comissão" });
    // linha adicional: não faz update do papel de membro
    expect(db.writes[0]).toEqual({
      op: "upsert",
      table: "user_roles",
      row: { user_id: MEMBER, role: "committee" },
      options: { onConflict: "user_id,role", ignoreDuplicates: true },
    });
    expect(screen.getAllByText("Comissão").length).toBeGreaterThan(0);

    await waitFor(() => expect(remove).toBeEnabled());
    fireEvent.click(remove);
    await screen.findByRole("button", { name: "Promover à Comissão" });
    expect(db.writes[1]).toEqual({ op: "delete", user_id: MEMBER, role: "committee" });
    expect(screen.queryByText("Comissão")).not.toBeInTheDocument();
  });

  it("quem não é Super Admin não vê o botão", async () => {
    db.superAdmin = false;
    await openMember();
    expect(await screen.findByText("Perfil do Membro")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Promover à Comissão" })).not.toBeInTheDocument();
  });
});
