import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const USER_ID = "11111111-1111-1111-1111-111111111111";

const insert = vi.fn(() => {
  const builder: Record<string, unknown> = {
    select: () => builder,
    single: () => Promise.resolve({ data: { id: "invite-1" }, error: null }),
  };
  return builder;
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert }) },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: USER_ID } }) }));
vi.mock("@/hooks/useGroupId", () => ({ useGroupId: () => ({ groupId: "group-1" }) }));

import InvitePage from "@/pages/InvitePage";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <InvitePage />
    </QueryClientProvider>,
  );

const fillAndSubmit = () => {
  const inputs = document.querySelectorAll("input");
  fireEvent.change(inputs[0], { target: { value: "Fabiana Dutra" } });
  fireEvent.change(inputs[2], { target: { value: "(53) 99467-0421" } });
  fireEvent.change(inputs[4], { target: { value: "2026-11-24" } });
  fireEvent.click(screen.getByRole("button", { name: /criar convite/i }));
};

describe("InvitePage", () => {
  it("grava o convite e mostra o card com o link wa.me pronto para abrir", async () => {
    renderPage();
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText(/convite criado para fabiana dutra/i)).toBeInTheDocument());

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: "group-1",
        invited_by: USER_ID,
        visitor_name: "Fabiana Dutra",
        visitor_whatsapp: "(53) 99467-0421",
        event_date: "2026-11-24",
      }),
    );

    const link = screen.getByRole("link", { name: /abrir whatsapp/i });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/5553994670421?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain("Oii Fabiana Dutra!");
    expect(decodeURIComponent(href)).toContain("24/11/2026");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: /copiar mensagem/i })).toBeInTheDocument();
  });
});
